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
    publicCapacity: Number(row.public_capacity ?? 0),
    registrations,
    seatsAvailable:
      extras.seatsAvailable ??
      Math.max(0, Number(row.capacity || 0) - Number(registrations || 0)),
    publicSeatsAvailable:
      extras.publicSeatsAvailable ??
      Math.max(0, Number(row.public_capacity ?? 0) - Number(extras.guestRegistrationsCount || 0)),
    status: toUiEventStatus(row.status),
    dbStatus: row.status,
    art: row.art_class || '',
    symbol: row.symbol || String(row.title || 'EV').slice(0, 2).toUpperCase(),
    bannerUrl: row.banner_url || null,
    characterKey: row.character_key || null,
    characterUrl: row.character_url || null,
    isPromoted: Boolean(row.is_promoted),
    promotedUntil: row.promoted_until || null,
    promotionTier: row.promotion_tier || 'standard',
    waitlistEnabled: row.waitlist_enabled !== false,
    registrationRequiresApproval: Boolean(row.registration_requires_approval),
    cancellationCutoffAt: row.cancellation_cutoff_at || null,
    registrationClosesAt: row.registration_closes_at || null,
    rules: row.rules || '',
    entryFee: Number(row.entry_fee || 0),
    earlyBirdFee:
      row.early_bird_fee == null || row.early_bird_fee === ''
        ? null
        : Number(row.early_bird_fee),
    earlyBirdUntil: row.early_bird_until || null,
    securityDeposit: Number(row.security_deposit || 0),
    currency: row.currency || 'pkr',
    depositRefundHours: Number(row.deposit_refund_hours ?? 24),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Resolve the entry fee a new registrant pays right now.
 * Early bird applies when fee + until are set and now < until.
 */
export function getEffectiveEntryFee(event, now = new Date()) {
  const regular = Number(event?.entryFee ?? event?.entry_fee ?? 0) || 0
  const early =
    event?.earlyBirdFee != null || event?.early_bird_fee != null
      ? Number(event.earlyBirdFee ?? event.early_bird_fee)
      : null
  const untilRaw = event?.earlyBirdUntil || event?.early_bird_until
  if (early == null || Number.isNaN(early) || !untilRaw) return regular
  const until = new Date(untilRaw).getTime()
  if (!Number.isFinite(until) || now.getTime() >= until) return regular
  return Math.max(0, early)
}

export function isEarlyBirdActive(event, now = new Date()) {
  const untilRaw = event?.earlyBirdUntil || event?.early_bird_until
  if (!untilRaw) return false
  const early =
    event?.earlyBirdFee != null || event?.early_bird_fee != null
      ? Number(event.earlyBirdFee ?? event.early_bird_fee)
      : null
  if (early == null || Number.isNaN(early)) return false
  const until = new Date(untilRaw).getTime()
  if (!Number.isFinite(until)) return false
  return now.getTime() < until
}

export function getEventPricing(event, now = new Date()) {
  const regularFee = Number(event?.entryFee ?? event?.entry_fee ?? 0) || 0
  const earlyBirdFee =
    event?.earlyBirdFee != null || event?.early_bird_fee != null
      ? Number(event.earlyBirdFee ?? event.early_bird_fee)
      : null
  const earlyBirdUntil = event?.earlyBirdUntil || event?.early_bird_until || null
  const active = isEarlyBirdActive(event, now)
  const fee = getEffectiveEntryFee(event, now)
  const deposit = Number(event?.securityDeposit ?? event?.security_deposit ?? 0) || 0
  return {
    fee,
    regularFee,
    earlyBirdFee,
    earlyBirdUntil,
    isEarlyBird: active,
    deposit,
    currency: event?.currency || 'pkr',
    total: fee + deposit,
  }
}

/** True when Stripe checkout / paid path is required for a new registration now. */
export function eventRequiresPayment(event, now = new Date()) {
  const pricing = getEventPricing(event, now)
  return pricing.fee > 0 || pricing.deposit > 0
}

export function formatMoney(amount, currency = 'pkr') {
  const n = Number(amount || 0)
  const cur = String(currency || 'pkr').toUpperCase()
  const locale = cur === 'PKR' ? 'en-PK' : 'en-US'
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur }).format(n)
  } catch {
    return `${cur} ${n.toFixed(2)}`
  }
}

/** Event accepts public / outsider guests (organizer opened public pool). */
export function isPublicGuestEvent(event) {
  return Number(event?.publicCapacity ?? event?.public_capacity ?? 0) > 0
}

export function pricingLabel(event, now = new Date()) {
  const pricing = getEventPricing(event, now)
  if (pricing.fee <= 0 && pricing.deposit <= 0) return 'Free'
  const cur = pricing.currency
  if (pricing.isEarlyBird && pricing.regularFee > pricing.fee) {
    const base =
      pricing.deposit > 0
        ? `${formatMoney(pricing.fee, cur)} early bird + ${formatMoney(pricing.deposit, cur)} deposit`
        : `${formatMoney(pricing.fee, cur)} early bird`
    return `${base} (then ${formatMoney(pricing.regularFee, cur)})`
  }
  if (pricing.fee > 0 && pricing.deposit > 0) {
    return `${formatMoney(pricing.fee, cur)} + ${formatMoney(pricing.deposit, cur)} deposit`
  }
  if (pricing.fee > 0) return formatMoney(pricing.fee, cur)
  return `${formatMoney(pricing.deposit, cur)} deposit`
}

export function formatEarlyBirdEnds(event) {
  const raw = event?.earlyBirdUntil || event?.early_bird_until
  if (!raw) return null
  try {
    return new Date(raw).toLocaleString()
  } catch {
    return String(raw)
  }
}

/** Validate early-bird fields before create/update. Returns error message or null. */
export function validateEarlyBirdPricing({
  entryFee,
  earlyBirdFee,
  earlyBirdUntil,
  eventStartIso,
}) {
  const regular = Math.max(0, Number(entryFee) || 0)
  const hasUntil = Boolean(earlyBirdUntil)
  const early =
    earlyBirdFee === '' || earlyBirdFee == null ? null : Number(earlyBirdFee)

  if (!hasUntil && (early == null || Number.isNaN(early))) return null

  if (hasUntil && (early == null || Number.isNaN(early))) {
    return 'Set an early-bird fee, or clear the early-bird end date'
  }
  if (!hasUntil && early != null && !Number.isNaN(early)) {
    return 'Set when early bird ends, or clear the early-bird fee'
  }
  if (early < 0) return 'Early-bird fee cannot be negative'
  if (regular <= 0) {
    return 'Early bird needs a regular entry fee greater than 0'
  }
  if (early >= regular) {
    return 'Early-bird fee must be lower than the regular entry fee'
  }
  const until = new Date(earlyBirdUntil).getTime()
  if (!Number.isFinite(until)) return 'Invalid early-bird end date/time'
  if (eventStartIso) {
    const start = new Date(eventStartIso).getTime()
    if (Number.isFinite(start) && until > start) {
      return 'Early bird must end on or before the event start'
    }
  }
  return null
}

export function mapUiEventToInsert(ui, organizerId) {
  const earlyRaw = ui.earlyBirdFee ?? ui.early_bird_fee
  const earlyBirdFee =
    earlyRaw === '' || earlyRaw == null ? null : Math.max(0, Number(earlyRaw) || 0)
  const earlyBirdUntil = ui.earlyBirdUntil || ui.early_bird_until || null

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
    public_capacity: Math.max(0, Number(ui.publicCapacity ?? ui.public_capacity ?? 0) || 0),
    waitlist_enabled: ui.waitlistEnabled !== false,
    registration_requires_approval: Boolean(ui.registrationRequiresApproval),
    status: toDbEventStatus(ui.status || EVENT_STATUS.PENDING),
    banner_url: ui.bannerUrl || ui.banner_url || null,
    character_key: ui.characterKey || ui.character_key || null,
    character_url: ui.characterUrl || ui.character_url || null,
    symbol: ui.symbol || null,
    art_class: ui.art || ui.art_class || null,
    rules: ui.rules || '',
    entry_fee: Number(ui.entryFee ?? ui.entry_fee ?? 0) || 0,
    early_bird_fee: earlyBirdUntil ? earlyBirdFee : null,
    early_bird_until: earlyBirdFee != null && earlyBirdUntil ? earlyBirdUntil : null,
    security_deposit: Number(ui.securityDeposit ?? ui.security_deposit ?? 0) || 0,
    currency: (ui.currency || 'pkr').toLowerCase(),
    deposit_refund_hours: Number(ui.depositRefundHours ?? ui.deposit_refund_hours ?? 24) || 24,
    is_promoted: Boolean(ui.isPromoted ?? ui.is_promoted),
    promoted_until: ui.promotedUntil || ui.promoted_until || null,
    promotion_tier: ui.promotionTier || ui.promotion_tier || 'standard',
    registration_closes_at:
      ui.registrationClosesAt || ui.registration_closes_at || null,
  }
}

/** True when registration_closes_at is in the past. Null close date = still open (until event end UI). */
export function isRegistrationClosed(event, now = new Date()) {
  const raw = event?.registrationClosesAt || event?.registration_closes_at
  if (!raw) return false
  const t = new Date(raw).getTime()
  if (!Number.isFinite(t)) return false
  return t < now.getTime()
}

export function formatRegistrationCloses(event) {
  const raw = event?.registrationClosesAt || event?.registration_closes_at
  if (!raw) return null
  try {
    return new Date(raw).toLocaleString()
  } catch {
    return String(raw)
  }
}

/** Build ISO from local date + time inputs (datetime-local / date+time). */
export function localDateTimeToIso(dateStr, timeStr = '23:59') {
  if (!dateStr) return null
  const time = String(timeStr || '23:59').slice(0, 5)
  const d = new Date(`${dateStr}T${time}:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export function isoToLocalDateTimeParts(iso) {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  const pad = (n) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
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
