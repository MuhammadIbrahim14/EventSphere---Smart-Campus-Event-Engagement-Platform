import { supabase } from '../lib/supabase.js'
import { RPC, TABLES } from '../constants/domain.js'
import { isRegistrationClosed, mapRegistrationRowToUi } from '../lib/eventMappers.js'
import { writePaymentAudit } from './paymentAudit.js'

function normalizeRpcRow(data) {
  if (!data) return null
  if (Array.isArray(data)) return data[0] || null
  return data
}

async function currentUserId() {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id || null
  } catch {
    return null
  }
}

export async function startPaidRegistration(eventId) {
  const { data: preview } = await supabase
    .from(TABLES.EVENTS)
    .select('registration_closes_at')
    .eq('id', eventId)
    .maybeSingle()
  if (isRegistrationClosed(preview)) {
    return { data: null, error: { message: 'Registration is closed for this event' } }
  }
  const { data, error } = await supabase.rpc(RPC.START_PAID_REGISTRATION, {
    p_event_id: eventId,
  })
  return { data: mapRegistrationRowToUi(normalizeRpcRow(data)), error }
}

/**
 * Create Stripe Checkout Session and return hosted URL.
 */
export async function createCheckoutSession({ eventId, successUrl, cancelUrl, promoCode }) {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      eventId,
      successUrl,
      cancelUrl,
      promoCode: promoCode ? String(promoCode).trim() : undefined,
    },
  })
  if (error) {
    const fromBody =
      (data && typeof data === 'object' && (data.error || data.message)) || null
    return {
      data: null,
      error: { message: fromBody || error.message || 'Checkout failed to start' },
    }
  }
  if (data?.error) {
    return { data: null, error: { message: data.error } }
  }
  return { data, error: null }
}

/**
 * After Stripe redirect (or for stuck pending): verify session and finalize seat.
 * Works even when the Stripe webhook is not configured yet.
 * Admin may pass registrationId to confirm another student's checkout.
 */
export async function confirmCheckoutSession({
  sessionId,
  eventId,
  registrationId,
} = {}) {
  const { data, error } = await supabase.functions.invoke('confirm-checkout-session', {
    body: { sessionId, eventId, registrationId },
  })
  if (error) {
    return {
      data: null,
      error: { message: error.message || 'Could not confirm payment' },
    }
  }
  if (data?.error) {
    return { data: null, error: { message: data.error } }
  }
  if (data?.ok || data?.alreadyPaid) {
    const actorId = await currentUserId()
    await writePaymentAudit({
      action: 'confirm',
      actorId,
      registrationId: data.registrationId || registrationId,
      eventId,
      detail: {
        source: 'confirmCheckoutSession',
        alreadyPaid: Boolean(data.alreadyPaid),
        sessionId: sessionId || null,
      },
    })
  }
  return { data, error: null }
}

/**
 * @param {'deposit'|'full'|'forfeit'|'cancel'} kind
 */
export async function processRegistrationPayment({
  registrationId,
  eventId,
  kind,
  studentId,
}) {
  const { data, error } = await supabase.functions.invoke('refund-deposit', {
    body: { registrationId, eventId, kind, studentId },
  })
  if (error) {
    return { data: null, error: { message: error.message || 'Payment action failed' } }
  }
  if (data?.error) {
    return { data: null, error: { message: data.error } }
  }
  if (data && !data.error) {
    const actorId = await currentUserId()
    const action =
      kind === 'full'
        ? 'full_refund'
        : kind === 'forfeit'
          ? 'forfeit'
          : kind === 'cancel'
            ? 'cancel_refund'
            : 'deposit_refund'
    await writePaymentAudit({
      action,
      actorId,
      registrationId,
      eventId,
      studentId,
      detail: { source: 'processRegistrationPayment', kind, result: data },
    })
  }
  return { data, error: null }
}

export async function refundEventPayments(eventId) {
  const { data, error } = await supabase.functions.invoke('refund-deposit', {
    body: { eventId, kind: 'event_cancel' },
  })
  if (error) {
    return { data: null, error: { message: error.message || 'Bulk refund failed' } }
  }
  if (data?.error) {
    return { data: null, error: { message: data.error } }
  }
  if (data && !data.error) {
    const actorId = await currentUserId()
    await writePaymentAudit({
      action: 'event_cancel_refund',
      actorId,
      eventId,
      detail: { source: 'refundEventPayments', results: data.results || data },
    })
  }
  return { data, error: null }
}

export async function listEventPayments(eventId) {
  const { data, error } = await supabase
    .from('event_payments')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function listAllPayments() {
  const { data, error } = await supabase
    .from('event_payments')
    .select('*, events:event_id ( title ), profiles:student_id ( full_name, email )')
    .order('created_at', { ascending: false })
    .limit(200)
  return { data, error }
}

/** Admin: mark organizer share settled (offline payout recorded). */
export async function settleRegistrationEarnings(registrationId) {
  const { data, error } = await supabase.rpc(RPC.SETTLE_REGISTRATION_EARNINGS, {
    p_registration_id: registrationId,
  })
  const row = normalizeRpcRow(data)
  if (!error && row) {
    const actorId = await currentUserId()
    await writePaymentAudit({
      action: 'settle_earnings',
      actorId,
      registrationId,
      eventId: row.event_id,
      studentId: row.student_id,
      detail: {
        organizer_share: row.organizer_share,
        platform_fee: row.platform_fee,
      },
    })
  }
  return { data: row ? mapRegistrationRowToUi(row) : null, error }
}

/** Admin: settle all held organizer shares for one event. */
export async function settleEventEarnings(eventId) {
  const { data, error } = await supabase.rpc(RPC.SETTLE_EVENT_EARNINGS, {
    p_event_id: eventId,
  })
  if (!error && data) {
    const actorId = await currentUserId()
    await writePaymentAudit({
      action: 'settle_event_earnings',
      actorId,
      eventId,
      detail: data,
    })
  }
  return { data, error }
}

export async function getPlatformCommissionPercent() {
  const { data, error } = await supabase.rpc(RPC.PLATFORM_COMMISSION_PERCENT)
  if (error) return { data: 20, error }
  return { data: Number(data) || 20, error: null }
}
