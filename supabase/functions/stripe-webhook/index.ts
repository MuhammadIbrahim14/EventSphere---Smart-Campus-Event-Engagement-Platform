import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!stripeKey || !webhookSecret) {
    return new Response('Stripe not configured', { status: 500 })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  const body = await req.text()
  let event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const registrationId =
        session.metadata?.registration_id || session.client_reference_id
      if (registrationId) {
        await admin.rpc('finalize_registration_payment', {
          p_registration_id: registrationId,
          p_checkout_session_id: session.id,
          p_payment_intent_id:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id || null,
          p_meta: {
            stripe_event_id: event.id,
            amount_total: session.amount_total,
            currency: session.currency,
          },
        })

        const promoId = session.metadata?.promo_id
        const eventId = session.metadata?.event_id
        const studentId = session.metadata?.student_id
        if (promoId && eventId && studentId) {
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
          if (!redErr && inserted) {
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
        }
      }
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object
      await admin.rpc('expire_registration_checkout', {
        p_checkout_session_id: session.id,
      })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
