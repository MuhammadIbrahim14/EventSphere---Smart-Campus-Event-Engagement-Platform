/**
 * Reusable mappers between DB rows and EventSphere UI event shapes.
 * Phase A: available for Phase B — not wired into App.tsx yet.
 */
import {
  EVENT_STATUS,
  EVENT_STATUS_LABEL,
  REGISTRATION_STATUS,
} from '../constants/domain.js'

export function toUiEventStatus(dbStatus) {
  return EVENT_STATUS_LABEL[dbStatus] || dbStatus || 'Pending'
}

export function toDbEventStatus(uiStatus) {
  const raw = String(uiStatus || '')
    .trim()
    .toLowerCase()
  if (Object.values(EVENT_STATUS).includes(raw)) return raw
  const hit = Object.entries(EVENT_STATUS_LABEL).find(
    ([, label]) => label.toLowerCase() === raw,
  )
  return hit ? hit[0] : EVENT_STATUS.PENDING
}

/**
 * Map a Supabase events row (+ optional joins) → App.tsx-friendly event object.
 */
export function mapEventRowToUi(row, extras = {}) {
  if (!row) return null
  const registrations =
    extras.registrationsCount ??
    row.registrations_count ??
    row.confirmed_count ??
    0

  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category,
    organizer:
      extras.organizerName ||
      row.organizer_name ||
      row.profiles?.full_name ||
      'Organizer',
    organizerId: row.organizer_id,
    date: row.event_date,
    time: row.event_time || '',
    endTime: row.event_end_time || '',
    venue: row.venue || row.venues?.name || '',
    venueId: row.venue_id || null,
    capacity: row.capacity,
    registrations,
    seatsAvailable:
      extras.seatsAvailable ??
      Math.max(0, Number(row.capacity || 0) - Number(registrations || 0)),
    status: toUiEventStatus(row.status),
    dbStatus: row.status,
    art: row.art_class || '',
    symbol: row.symbol || String(row.title || 'EV').slice(0, 2).toUpperCase(),
    bannerUrl: row.banner_url || null,
    waitlistEnabled: row.waitlist_enabled !== false,
    registrationRequiresApproval: Boolean(row.registration_requires_approval),
    cancellationCutoffAt: row.cancellation_cutoff_at || null,
    rules: row.rules || '',
    entryFee: Number(row.entry_fee || 0),
    securityDeposit: Number(row.security_deposit || 0),
    currency: row.currency || 'usd',
    depositRefundHours: Number(row.deposit_refund_hours ?? 24),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** True when Stripe checkout is required. */
export function eventRequiresPayment(event) {
  return Number(event?.entryFee || 0) > 0 || Number(event?.securityDeposit || 0) > 0
}

export function formatMoney(amount, currency = 'usd') {
  const n = Number(amount || 0)
  const cur = String(currency || 'usd').toUpperCase()
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n)
  } catch {
    return `${cur} ${n.toFixed(2)}`
  }
}

export function pricingLabel(event) {
  if (!eventRequiresPayment(event)) return 'Free'
  const fee = Number(event.entryFee || 0)
  const dep = Number(event.securityDeposit || 0)
  const cur = event.currency || 'usd'
  if (fee > 0 && dep > 0) {
    return `${formatMoney(fee, cur)} + ${formatMoney(dep, cur)} deposit`
  }
  if (fee > 0) return formatMoney(fee, cur)
  return `${formatMoney(dep, cur)} deposit`
}

export function mapUiEventToInsert(ui, organizerId) {
  return {
    title: ui.title,
    description: ui.description || '',
    category: ui.category,
    event_date: ui.date || ui.event_date,
    event_time: ui.time || ui.event_time || '',
    event_end_time: ui.endTime || ui.event_end_time || '',
    venue: ui.venue || '',
    venue_id: ui.venueId || ui.venue_id || null,
    organizer_id: organizerId,
    capacity: Number(ui.capacity) || 100,
    waitlist_enabled: ui.waitlistEnabled !== false,
    registration_requires_approval: Boolean(ui.registrationRequiresApproval),
    status: toDbEventStatus(ui.status || EVENT_STATUS.PENDING),
    banner_url: ui.bannerUrl || ui.banner_url || null,
    symbol: ui.symbol || null,
    art_class: ui.art || ui.art_class || null,
    rules: ui.rules || '',
    entry_fee: Number(ui.entryFee ?? ui.entry_fee ?? 0) || 0,
    security_deposit: Number(ui.securityDeposit ?? ui.security_deposit ?? 0) || 0,
    currency: (ui.currency || 'usd').toLowerCase(),
    deposit_refund_hours: Number(ui.depositRefundHours ?? ui.deposit_refund_hours ?? 24) || 24,
  }
}

export function mapRegistrationRowToUi(row) {
  if (!row) return null
  return {
    id: row.id,
    eventId: row.event_id,
    studentId: row.student_id,
    status: row.status,
    registeredOn: row.registered_on,
    cancelledOn: row.cancelled_on,
    paymentStatus: row.payment_status || 'not_required',
    feeAmount: Number(row.fee_amount || 0),
    depositAmount: Number(row.deposit_amount || 0),
    amountTotal: Number(row.amount_total || 0),
    stripeCheckoutSessionId: row.stripe_checkout_session_id || null,
    stripePaymentIntentId: row.stripe_payment_intent_id || null,
    paidAt: row.paid_at || null,
    depositRefundedAt: row.deposit_refunded_at || null,
    depositRefundId: row.deposit_refund_id || null,
    isActive: [
      REGISTRATION_STATUS.CONFIRMED,
      REGISTRATION_STATUS.WAITLIST,
      REGISTRATION_STATUS.PENDING,
      REGISTRATION_STATUS.PENDING_PAYMENT,
    ].includes(row.status),
  }
}
