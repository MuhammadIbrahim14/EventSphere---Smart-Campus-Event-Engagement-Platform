// @ts-nocheck — Supabase Edge Function (Deno); IDE uses Node TS otherwise
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return json({ error: 'STRIPE_SECRET_KEY not configured' }, 500)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing auth' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const admin = createClient(supabaseUrl, serviceKey)
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Sign in required' }, 401)

    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const role = String(profile?.role || '').toLowerCase()
    const isStaff = role === 'admin' || role === 'organizer'

    const body = await req.json()
    const kind = body.kind || 'deposit'
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    if (kind === 'event_cancel') {
      if (!isStaff) return json({ error: 'Staff only' }, 403)
      const eventId = body.eventId
      if (!eventId) return json({ error: 'Missing eventId' }, 400)

      if (role === 'organizer') {
        const { data: ev } = await admin
          .from('events')
          .select('organizer_id')
          .eq('id', eventId)
          .maybeSingle()
        if (ev?.organizer_id !== user.id) {
          return json({ error: 'Not your event' }, 403)
        }
      }

      const { data: regs } = await admin
        .from('registrations')
        .select('*')
        .eq('event_id', eventId)
        .eq('payment_status', 'paid')

      const results = []
      for (const reg of regs || []) {
        if (!reg.stripe_payment_intent_id) continue
        const refund = await stripe.refunds.create({
          payment_intent: reg.stripe_payment_intent_id,
          reason: 'requested_by_customer',
          metadata: { kind: 'full', registration_id: reg.id, event_id: eventId },
        })
        await admin.rpc('mark_full_refund', {
          p_registration_id: reg.id,
          p_refund_id: refund.id,
          p_meta: { reason: 'event_cancelled' },
        })
        results.push({ registrationId: reg.id, refundId: refund.id })
      }
      return json({ ok: true, results })
    }

    const registrationId = body.registrationId
    if (!registrationId) return json({ error: 'Missing registrationId' }, 400)

    const { data: reg, error: regErr } = await admin
      .from('registrations')
      .select('*, events:event_id ( organizer_id, deposit_refund_hours, event_date, event_time )')
      .eq('id', registrationId)
      .maybeSingle()
    if (regErr || !reg) return json({ error: 'Registration not found' }, 404)

    const organizerId = reg.events?.organizer_id
    const isOwner = reg.student_id === user.id
    const isEventOrg = organizerId === user.id
    if (!isOwner && !isEventOrg && role !== 'admin') {
      return json({ error: 'Forbidden' }, 403)
    }

    if (kind === 'forfeit') {
      if (!isStaff && !isEventOrg) return json({ error: 'Staff only' }, 403)
      const { data, error } = await admin.rpc('mark_registration_forfeited', {
        p_registration_id: registrationId,
      })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, registration: data })
    }

    if (kind === 'cancel') {
      // Student cancel: refund deposit if far enough before start; else forfeit
      if (!isOwner && !isStaff) return json({ error: 'Forbidden' }, 403)
      if (reg.payment_status !== 'paid' || Number(reg.deposit_amount || 0) <= 0) {
        return json({ ok: true, skipped: true })
      }
      const hours = Number(reg.events?.deposit_refund_hours ?? 24)
      const start = parseEventStart(reg.events?.event_date, reg.events?.event_time)
      const msLeft = start ? start.getTime() - Date.now() : 0
      const eligible = msLeft >= hours * 3600 * 1000

      if (!eligible) {
        await admin.rpc('mark_registration_forfeited', {
          p_registration_id: registrationId,
        })
        return json({ ok: true, forfeited: true })
      }

      if (!reg.stripe_payment_intent_id) {
        return json({ error: 'Missing payment intent' }, 400)
      }
      const refund = await stripe.refunds.create({
        payment_intent: reg.stripe_payment_intent_id,
        amount: Math.round(Number(reg.deposit_amount) * 100),
        metadata: { kind: 'deposit_cancel', registration_id: registrationId },
      })
      await admin.rpc('mark_deposit_refunded', {
        p_registration_id: registrationId,
        p_refund_id: refund.id,
        p_amount: Number(reg.deposit_amount),
        p_meta: { reason: 'student_cancel' },
      })
      return json({ ok: true, refundId: refund.id })
    }

    if (kind === 'full') {
      if (!isStaff && !isEventOrg) return json({ error: 'Staff only' }, 403)
      if (!reg.stripe_payment_intent_id) return json({ error: 'Missing payment intent' }, 400)
      const refund = await stripe.refunds.create({
        payment_intent: reg.stripe_payment_intent_id,
        metadata: { kind: 'full', registration_id: registrationId },
      })
      await admin.rpc('mark_full_refund', {
        p_registration_id: registrationId,
        p_refund_id: refund.id,
        p_meta: { reason: 'manual_full' },
      })
      return json({ ok: true, refundId: refund.id })
    }

    // deposit refund (Present)
    if (!isStaff && !isEventOrg) return json({ error: 'Staff only' }, 403)
    if (reg.payment_status !== 'paid' && reg.payment_status !== 'partially_refunded') {
      return json({ error: 'Nothing to refund' }, 400)
    }
    if (Number(reg.deposit_amount || 0) <= 0) {
      return json({ ok: true, skipped: true })
    }
    if (reg.deposit_refund_id) {
      return json({ ok: true, alreadyRefunded: true })
    }
    if (!reg.stripe_payment_intent_id) {
      return json({ error: 'Missing payment intent' }, 400)
    }

    const refund = await stripe.refunds.create({
      payment_intent: reg.stripe_payment_intent_id,
      amount: Math.round(Number(reg.deposit_amount) * 100),
      metadata: { kind: 'deposit', registration_id: registrationId },
    })
    await admin.rpc('mark_deposit_refunded', {
      p_registration_id: registrationId,
      p_refund_id: refund.id,
      p_amount: Number(reg.deposit_amount),
      p_meta: { reason: 'attendance_present' },
    })
    return json({ ok: true, refundId: refund.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Refund error'
    return json({ error: message }, 500)
  }
})

function parseEventStart(dateStr?: string, timeStr?: string) {
  if (!dateStr) return null
  const t = (timeStr || '00:00').slice(0, 5)
  const d = new Date(`${String(dateStr).slice(0, 10)}T${t}:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
