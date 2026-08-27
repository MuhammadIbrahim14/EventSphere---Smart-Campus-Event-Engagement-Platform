import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Client-side success return: verify Checkout Session with Stripe API and
 * finalize the registration even if the webhook is missing / delayed.
 * Admin may pass registrationId to confirm another student's paid session.
 */
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
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Sign in required' }, 401)

    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const isAdmin = String(profile?.role || '').toLowerCase() === 'admin'

    const body = await req.json().catch(() => ({}))
    let sessionId = body.sessionId || body.session_id || null
    const eventId = body.eventId || body.event_id || null
    const registrationIdIn = body.registrationId || body.registration_id || null

    // Admin: resolve session from any registration id
    if (!sessionId && registrationIdIn && isAdmin) {
      const { data: reg, error: regErr } = await admin
        .from('registrations')
        .select('id, stripe_checkout_session_id, payment_status, student_id')
        .eq('id', registrationIdIn)
        .maybeSingle()
      if (regErr) return json({ error: regErr.message }, 400)
      if (!reg) return json({ error: 'Registration not found' }, 404)
      if (reg.payment_status === 'paid') {
        return json({ ok: true, alreadyPaid: true, registrationId: reg.id })
      }
      sessionId = reg.stripe_checkout_session_id
      if (!sessionId) {
        return json(
          {
            error:
              'No Stripe session on this registration. Student must complete checkout again.',
          },
          400,
        )
      }
    }

    // Student: resolve session from own registration for event
    if (!sessionId && eventId) {
      const { data: reg, error: regErr } = await userClient
        .from('registrations')
        .select('id, stripe_checkout_session_id, payment_status, status')
        .eq('event_id', eventId)
        .eq('student_id', user.id)
        .maybeSingle()
      if (regErr) return json({ error: regErr.message }, 400)
      if (!reg) return json({ error: 'Registration not found' }, 404)
      if (reg.payment_status === 'paid') {
        return json({ ok: true, alreadyPaid: true, registrationId: reg.id })
      }
      sessionId = reg.stripe_checkout_session_id
      if (!sessionId) {
        return json(
          {
            error:
              'No Stripe session on this registration yet. Complete checkout again, or wait for the webhook.',
          },
          400,
        )
      }
    }

    if (!sessionId) return json({ error: 'Missing sessionId, eventId, or registrationId' }, 400)

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return json(
        {
          error: `Checkout not paid yet (status=${session.status}, payment=${session.payment_status})`,
          paymentStatus: session.payment_status,
        },
        400,
      )
    }

    const registrationId =
      session.metadata?.registration_id ||
      session.client_reference_id ||
      registrationIdIn
    if (!registrationId) {
      return json({ error: 'Session missing registration_id metadata' }, 400)
    }

    const metaStudent = session.metadata?.student_id
    if (!isAdmin && metaStudent && metaStudent !== user.id) {
      return json({ error: 'Session does not belong to this user' }, 403)
    }

    if (!isAdmin) {
      const { data: owned, error: ownedErr } = await userClient
        .from('registrations')
        .select('id, student_id')
        .eq('id', registrationId)
        .maybeSingle()
      if (ownedErr) return json({ error: ownedErr.message }, 400)
      if (!owned || owned.student_id !== user.id) {
        return json({ error: 'Registration not found for this user' }, 403)
      }
    }

    const { data: finalized, error: finErr } = await admin.rpc(
      'finalize_registration_payment',
      {
        p_registration_id: registrationId,
        p_checkout_session_id: session.id,
        p_payment_intent_id:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || null,
        p_meta: {
          source: isAdmin ? 'admin-confirm-checkout' : 'confirm-checkout-session',
          amount_total: session.amount_total,
          currency: session.currency,
          confirmed_by: user.id,
        },
      },
    )
    if (finErr) return json({ error: finErr.message }, 500)

    const promoId = session.metadata?.promo_id
    const metaEventId = session.metadata?.event_id || eventId
    const redeemStudentId = session.metadata?.student_id || user.id
    if (promoId && metaEventId && redeemStudentId) {
      await redeemPromoAdmin(admin, {
        promoId: String(promoId),
        studentId: String(redeemStudentId),
        eventId: String(metaEventId),
        registrationId: String(registrationId),
      })
    }

    const row = Array.isArray(finalized) ? finalized[0] : finalized
    return json({
      ok: true,
      registrationId,
      paymentStatus: row?.payment_status || 'paid',
      status: row?.status,
      promoCode: session.metadata?.promo_code || null,
    })
  } catch (err) {
    return json({ error: err?.message || 'Confirm checkout failed' }, 500)
  }
})

async function redeemPromoAdmin(
  admin: ReturnType<typeof createClient>,
  {
    promoId,
    studentId,
    eventId,
    registrationId,
  }: { promoId: string; studentId: string; eventId: string; registrationId: string },
) {
  const { data: inserted, error: redErr } = await admin
    .from('promo_redemptions')
    .insert({
      promo_id: promoId,
      student_id: studentId,
      event_id: eventId,
      registration_id: registrationId,
    })
    .select('id')
    .maybeSingle()

  if (redErr) {
    if (/duplicate|unique/i.test(redErr.message || '')) return
    console.error('promo redeem insert', redErr.message)
    return
  }
  if (!inserted) return

  const { data: promo } = await admin
    .from('promo_codes')
    .select('used_count')
    .eq('id', promoId)
    .maybeSingle()
  await admin
    .from('promo_codes')
    .update({ used_count: (promo?.used_count || 0) + 1 })
    .eq('id', promoId)
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
