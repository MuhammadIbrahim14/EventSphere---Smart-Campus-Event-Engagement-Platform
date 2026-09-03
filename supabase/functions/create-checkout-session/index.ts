import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function applyPromoDiscount(amount: number, promo: { discount_type: string; value: number }) {
  const base = Number(amount) || 0
  if (!promo) return base
  if (promo.discount_type === 'percent') {
    return Math.max(0, +(base * (1 - Number(promo.value) / 100)).toFixed(2))
  }
  return Math.max(0, +(base - Number(promo.value)).toFixed(2))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return json({ error: 'STRIPE_SECRET_KEY not configured' }, 500)
    }

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

    const body = await req.json()
    const eventId = body.eventId
    const promoCodeRaw = String(body.promoCode || body.promo_code || '').trim()
    if (!eventId) return json({ error: 'Missing eventId' }, 400)

    const origin = body.origin || new URL(req.url).origin
    const successUrl =
      body.successUrl ||
      `${origin}/student/registrations?paid=1&event=${encodeURIComponent(eventId)}&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl =
      body.cancelUrl || `${origin}/student/event/${encodeURIComponent(eventId)}`

    const { data: reg, error: regErr } = await userClient.rpc('start_paid_registration', {
      p_event_id: eventId,
    })
    if (regErr) return json({ error: regErr.message }, 400)

    const registration = Array.isArray(reg) ? reg[0] : reg
    if (!registration?.id) return json({ error: 'Could not start registration' }, 400)

    if (registration.payment_status === 'paid') {
      return json({ alreadyPaid: true, registrationId: registration.id })
    }

    const { data: ev, error: evErr } = await userClient
      .from('events')
      .select('id, title, entry_fee, early_bird_fee, early_bird_until, security_deposit, currency, registration_closes_at')
      .eq('id', eventId)
      .single()
    if (evErr || !ev) return json({ error: evErr?.message || 'Event not found' }, 404)

    if (ev.registration_closes_at && new Date(ev.registration_closes_at) < new Date()) {
      return json({ error: 'Registration is closed for this event' }, 400)
    }

    const regularFee = Number(ev.entry_fee || 0)
    const earlyFee =
      ev.early_bird_fee == null ? null : Number(ev.early_bird_fee)
    const earlyUntil = ev.early_bird_until ? new Date(ev.early_bird_until).getTime() : NaN
    const earlyActive =
      earlyFee != null &&
      !Number.isNaN(earlyFee) &&
      Number.isFinite(earlyUntil) &&
      Date.now() < earlyUntil
    const fee = earlyActive ? Math.max(0, earlyFee) : regularFee
    const deposit = Number(ev.security_deposit || 0)
    const currency = String(ev.currency || 'usd').toLowerCase()
    if (fee + deposit <= 0) return json({ error: 'Event does not require payment' }, 400)

    let discountedFee = fee
    let promo: Record<string, unknown> | null = null

    if (promoCodeRaw) {
      const normalized = promoCodeRaw.toUpperCase()
      const { data: found, error: promoErr } = await userClient
        .from('promo_codes')
        .select('*, events:event_id ( id, title, registration_closes_at )')
        .eq('code', normalized)
        .eq('active', true)
        .maybeSingle()

      if (promoErr) return json({ error: promoErr.message }, 400)
      if (!found) return json({ error: 'Invalid promo code' }, 400)
      if (found.expires_at && new Date(found.expires_at) < new Date()) {
        return json({ error: 'Promo code expired' }, 400)
      }
      if (found.max_uses != null && Number(found.used_count || 0) >= Number(found.max_uses)) {
        return json({ error: 'Promo code fully redeemed' }, 400)
      }
      // Event-scoped sponsorship codes only work on that event
      if (found.event_id) {
        if (found.event_id !== eventId) {
          return json({ error: 'Code not valid for this event' }, 400)
        }
        const linkedCloses = (found.events as { registration_closes_at?: string } | null)?.registration_closes_at
        if (linkedCloses && new Date(linkedCloses) < new Date()) {
          return json({ error: 'Promo expired — registration closed for this event' }, 400)
        }
      }
      // Checkout event registration closed (already checked above, but keep promo clear)
      if (ev.registration_closes_at && new Date(ev.registration_closes_at) < new Date()) {
        return json({ error: 'Registration closed — promo no longer available' }, 400)
      }

      const { data: prior } = await userClient
        .from('promo_redemptions')
        .select('id')
        .eq('promo_id', found.id)
        .eq('student_id', user.id)
        .maybeSingle()
      if (prior) return json({ error: 'You already used this code' }, 400)

      promo = found
      discountedFee = applyPromoDiscount(fee, found as { discount_type: string; value: number })
    }

    const total = discountedFee + deposit

    await admin
      .from('registrations')
      .update({
        fee_amount: discountedFee,
        deposit_amount: deposit,
        amount_total: total,
        payment_meta: {
          ...(typeof registration.payment_meta === 'object' && registration.payment_meta
            ? registration.payment_meta
            : {}),
          currency,
          original_fee: fee,
          regular_fee: regularFee,
          early_bird_applied: earlyActive,
          promo_id: promo?.id || null,
          promo_code: promo ? String(promo.code) : null,
          discount_type: promo?.discount_type || null,
          discount_value: promo?.value ?? null,
        },
      })
      .eq('id', registration.id)

    // 100% off fee and no deposit — no Stripe charge needed
    if (Math.round(total * 100) <= 0) {
      await admin.rpc('finalize_registration_payment', {
        p_registration_id: registration.id,
        p_checkout_session_id: `promo_free_${registration.id}`,
        p_payment_intent_id: null,
        p_meta: {
          source: 'promo-zero-total',
          promo_id: promo?.id || null,
          promo_code: promo ? String(promo.code) : null,
        },
      })
      if (promo?.id) {
        await redeemPromoAdmin(admin, {
          promoId: String(promo.id),
          studentId: user.id,
          eventId,
          registrationId: registration.id,
        })
      }
      return json({
        alreadyPaid: true,
        freeWithPromo: true,
        registrationId: registration.id,
        discountedFee,
        deposit,
        total: 0,
      })
    }

    const line_items = []
    if (discountedFee > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: Math.round(discountedFee * 100),
          product_data: {
            name: earlyActive
              ? `Early-bird fee — ${ev.title}`
              : `Event fee — ${ev.title}`,
            description: promo
              ? `Promo ${String(promo.code)} applied (was ${fee.toFixed(2)})`
              : earlyActive && regularFee > fee
                ? `Early bird — regular fee ${regularFee.toFixed(2)} after window`
                : undefined,
          },
        },
      })
    }
    if (deposit > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: Math.round(deposit * 100),
          product_data: {
            name: `Security deposit (refundable) — ${ev.title}`,
            description: 'Refunded when marked Present at the event',
          },
        },
      })
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    // Prefer verified personal email for receipts — never synthetic enrollment@students…
    const SYNTHETIC_SUFFIX = '@students.eventsphere.local'
    const isSynthetic = (raw: string) =>
      String(raw || '')
        .trim()
        .toLowerCase()
        .endsWith(SYNTHETIC_SUFFIX)

    const { data: payProfile } = await admin
      .from('profiles')
      .select('email, personal_email, personal_email_verified')
      .eq('id', user.id)
      .maybeSingle()

    let customerEmail = ''
    if (payProfile?.personal_email_verified && payProfile?.personal_email) {
      customerEmail = String(payProfile.personal_email).trim()
    } else if (user.email && !isSynthetic(user.email)) {
      customerEmail = String(user.email).trim()
    } else if (payProfile?.email && !isSynthetic(payProfile.email)) {
      customerEmail = String(payProfile.email).trim()
    }

    if (!customerEmail) {
      return json(
        {
          error:
            'Link and verify a personal email in Profile before paying — Stripe receipts need a real inbox.',
        },
        400,
      )
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customerEmail,
      line_items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: registration.id,
      metadata: {
        registration_id: registration.id,
        event_id: eventId,
        student_id: user.id,
        fee_amount: String(discountedFee),
        deposit_amount: String(deposit),
        original_fee: String(fee),
        promo_id: promo ? String(promo.id) : '',
        promo_code: promo ? String(promo.code) : '',
        receipt_email: customerEmail,
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    })

    await userClient.rpc('mark_registration_checkout_session', {
      p_registration_id: registration.id,
      p_checkout_session_id: session.id,
    })

    return json({
      url: session.url,
      sessionId: session.id,
      registrationId: registration.id,
      discountedFee,
      deposit,
      total,
      promoCode: promo ? String(promo.code) : null,
    })
  } catch (err) {
    return json({ error: err?.message || 'Checkout error' }, 500)
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
