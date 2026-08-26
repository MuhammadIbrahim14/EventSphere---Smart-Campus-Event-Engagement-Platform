/**
 * Events API (Phase A foundation — not wired into App.tsx yet).
 * Uses domain constants; no hardcoded table/status strings.
 */
import { supabase } from '../../src/lib/supabase.js'
import {
  ANNOUNCEMENT_AUDIENCE,
  EVENT_STATUS,
  RPC,
  TABLES,
} from '../../src/constants/domain.js'
import {
  mapEventRowToUi,
  mapUiEventToInsert,
  toDbEventStatus,
} from '../../src/lib/eventMappers.js'
import { createAnnouncement } from './announcements.js'
import { refundEventPayments } from '../../src/services/payments.js'
import { generateCheckinToken } from '../../src/lib/stationCheckin.js'

const EVENT_SELECT = `
  id, title, description, category, event_date, event_time, event_end_time, venue, venue_id,
  organizer_id, capacity, waitlist_enabled, registration_requires_approval,
  cancellation_cutoff_at, registration_closes_at, status, banner_url, character_key, character_url, symbol, art_class, rules,
  entry_fee, security_deposit, currency, deposit_refund_hours,
  is_promoted, promoted_until, promotion_tier,
  created_at, updated_at,
  venues:venue_id ( name, location, capacity )
`

export async function listEvents({ status, organizerId, category } = {}) {
  let query = supabase
    .from(TABLES.EVENTS)
    .select(EVENT_SELECT)
    .order('event_date', { ascending: true })

  if (status) query = query.eq('status', toDbEventStatus(status))
  if (organizerId) query = query.eq('organizer_id', organizerId)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return { data: null, error }

  const mapped = await Promise.all(
    (data || []).map(async (row) => {
      let count = 0
      try {
        const { data: c } = await supabase.rpc(RPC.CONFIRMED_REGISTRATION_COUNT, {
          p_event_id: row.id,
        })
        count = c ?? 0
      } catch {
        count = 0
      }
      return mapEventRowToUi(row, {
        organizerName: row.organizer_name || null,
        registrationsCount: count,
      })
    }),
  )

  return { data: mapped, error: null }
}

export async function listApprovedEvents(filters = {}) {
  return listEvents({ ...filters, status: EVENT_STATUS.APPROVED })
}

export async function getEvent(id) {
  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .select(EVENT_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return { data: null, error }

  const { data: count } = await supabase.rpc(RPC.CONFIRMED_REGISTRATION_COUNT, {
    p_event_id: id,
  })
  const { data: seats } = await supabase.rpc(RPC.SEATS_AVAILABLE, {
    p_event_id: id,
  })

  return {
    data: mapEventRowToUi(data, {
      organizerName: null,
      registrationsCount: count ?? 0,
      seatsAvailable: seats ?? 0,
    }),
    error: null,
  }
}

export async function createEvent(payload, organizerId) {
  const row = mapUiEventToInsert(payload, organizerId)
  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .insert([row])
    .select(EVENT_SELECT)
    .single()

  if (error) return { data: null, error }
  return {
    data: mapEventRowToUi(data),
    error: null,
  }
}

export async function updateEvent(id, updates) {
  const src = updates || {}
  const patch = {}

  if (src.title != null) patch.title = String(src.title).trim()
  if (src.description != null) patch.description = src.description
  if (src.category != null) patch.category = src.category
  if (src.venue != null) patch.venue = src.venue
  if (src.venueId != null || src.venue_id != null) {
    patch.venue_id = src.venueId ?? src.venue_id
  }
  if (src.capacity != null) patch.capacity = Number(src.capacity) || 0
  if (src.rules != null) patch.rules = src.rules
  if (src.date || src.event_date) patch.event_date = src.date || src.event_date
  if (src.time != null || src.event_time != null) {
    patch.event_time = src.time ?? src.event_time
  }
  if (src.endTime != null || src.event_end_time != null) {
    patch.event_end_time = src.endTime ?? src.event_end_time
  }
  if (src.status != null) patch.status = toDbEventStatus(src.status)
  if (src.bannerUrl !== undefined || src.banner_url !== undefined) {
    patch.banner_url = src.bannerUrl ?? src.banner_url
  }
  if (src.characterKey !== undefined || src.character_key !== undefined) {
    const key = src.characterKey ?? src.character_key
    patch.character_key = key ? String(key) : null
  }
  if (src.characterUrl !== undefined || src.character_url !== undefined) {
    const url = src.characterUrl ?? src.character_url
    patch.character_url = url ? String(url) : null
  }
  if (src.symbol != null) patch.symbol = src.symbol
  if (src.art != null || src.art_class != null) {
    patch.art_class = src.art ?? src.art_class
  }
  if (src.waitlistEnabled != null || src.waitlist_enabled != null) {
    patch.waitlist_enabled = src.waitlistEnabled ?? src.waitlist_enabled
  }
  if (
    src.registrationRequiresApproval != null ||
    src.registration_requires_approval != null
  ) {
    patch.registration_requires_approval =
      src.registrationRequiresApproval ?? src.registration_requires_approval
  }
  if (src.entryFee != null || src.entry_fee != null) {
    patch.entry_fee = Number(src.entryFee ?? src.entry_fee) || 0
  }
  if (src.securityDeposit != null || src.security_deposit != null) {
    patch.security_deposit = Number(src.securityDeposit ?? src.security_deposit) || 0
  }
  if (src.currency != null) patch.currency = String(src.currency).toLowerCase()
  if (src.depositRefundHours != null || src.deposit_refund_hours != null) {
    patch.deposit_refund_hours =
      Number(src.depositRefundHours ?? src.deposit_refund_hours) || 24
  }
  if (src.isPromoted != null || src.is_promoted != null) {
    patch.is_promoted = Boolean(src.isPromoted ?? src.is_promoted)
  }
  if (src.promotedUntil !== undefined || src.promoted_until !== undefined) {
    patch.promoted_until = src.promotedUntil ?? src.promoted_until
  }
  if (src.promotionTier != null || src.promotion_tier != null) {
    patch.promotion_tier = src.promotionTier ?? src.promotion_tier
  }
  if (src.registrationClosesAt !== undefined || src.registration_closes_at !== undefined) {
    patch.registration_closes_at =
      src.registrationClosesAt ?? src.registration_closes_at ?? null
  }

  if (!Object.keys(patch).length) {
    return { data: null, error: { message: 'No fields to update' } }
  }

  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .update(patch)
    .eq('id', id)
    .select(EVENT_SELECT)
    .single()

  if (error) return { data: null, error }
  return {
    data: mapEventRowToUi(data),
    error: null,
  }
}

export async function setEventStatus(id, status) {
  return updateEvent(id, { status: toDbEventStatus(status) })
}

/**
 * Set / extend registration_closes_at. When the deadline moves later,
 * notify every student profile on EventSphere + publish an announcement.
 */
export async function extendRegistrationDeadline(
  id,
  { registrationClosesAt, reason, createdBy, title } = {},
) {
  if (!registrationClosesAt) {
    return { data: null, error: { message: 'New registration close date is required' } }
  }

  const newTs = new Date(registrationClosesAt).getTime()
  if (!Number.isFinite(newTs)) {
    return { data: null, error: { message: 'Invalid registration close date' } }
  }

  const { data: current, error: curErr } = await supabase
    .from(TABLES.EVENTS)
    .select('id, title, registration_closes_at, organizer_id')
    .eq('id', id)
    .maybeSingle()

  if (curErr) return { data: null, error: curErr }
  if (!current) return { data: null, error: { message: 'Event not found' } }

  const oldTs = current.registration_closes_at
    ? new Date(current.registration_closes_at).getTime()
    : null
  const isExtension = oldTs == null || newTs > oldTs

  const { data, error } = await updateEvent(id, {
    registrationClosesAt: new Date(registrationClosesAt).toISOString(),
  })
  if (error) return { data: null, error }

  if (!isExtension) {
    return { data, error: null, notified: 0, extended: false }
  }

  const name = title || data?.title || current.title || 'Event'
  const whenLabel = new Date(registrationClosesAt).toLocaleString()
  const body = [
    `${name} — registration window extended.`,
    `New close time: ${whenLabel}.`,
    reason ? `Reason: ${reason}` : '',
    'You can still register if seats remain.',
  ]
    .filter(Boolean)
    .join(' ')

  let notified = 0
  const { data: count, error: notifyErr } = await supabase.rpc(
    'notify_registration_deadline_extended',
    {
      p_event_id: id,
      p_new_closes_at: new Date(registrationClosesAt).toISOString(),
      p_reason: reason || '',
    },
  )
  if (!notifyErr) notified = Number(count) || 0

  const ann = await createAnnouncement({
    title: `Registration extended: ${name}`,
    body,
    audience: ANNOUNCEMENT_AUDIENCE.STUDENTS,
    eventId: id,
    createdBy,
    isPublished: true,
  })

  if (notifyErr && ann.error) {
    return {
      data,
      error: {
        message: `Deadline updated, but student notify failed: ${notifyErr.message}`,
      },
      notified: 0,
      extended: true,
    }
  }

  return {
    data,
    error: null,
    notified,
    extended: true,
    announcement: ann.data || null,
  }
}

/**
 * Move event date/time forward and publish a student-facing announcement.
 */
export async function postponeEvent(id, { date, time, reason, createdBy, title } = {}) {
  if (!date) return { data: null, error: { message: 'New date is required' } }

  const { data, error } = await updateEvent(id, {
    date,
    ...(time != null ? { time } : {}),
  })
  if (error) return { data: null, error }

  const oldLabel = title || data?.title || 'Event'
  const when = `${date}${time ? ` · ${time}` : ''}`
  const body = [
    `${oldLabel} has been postponed.`,
    `New schedule: ${when}.`,
    reason ? `Reason: ${reason}` : '',
    'Your registration remains active — check My Passes for the updated date.',
  ]
    .filter(Boolean)
    .join(' ')

  const ann = await createAnnouncement({
    title: `Postponed: ${oldLabel}`,
    body,
    audience: ANNOUNCEMENT_AUDIENCE.STUDENTS,
    eventId: id,
    createdBy,
    isPublished: true,
  })

  if (ann.error) {
    return {
      data,
      error: {
        message: `Date updated to ${when}, but notification failed: ${ann.error.message}`,
      },
      announcement: null,
    }
  }

  return {
    data,
    error: null,
    announcement: ann.data,
  }
}

/**
 * Cancel event (soft) and notify students.
 */
export async function cancelEventWithNotice(id, { reason, createdBy, title } = {}) {
  const { data, error } = await setEventStatus(id, EVENT_STATUS.CANCELLED)
  if (error) return { data: null, error }

  const name = title || data?.title || 'Event'
  const body = [
    `${name} has been cancelled by the organizer.`,
    reason ? `Reason: ${reason}` : '',
    'Your registration is no longer active for this date.',
  ]
    .filter(Boolean)
    .join(' ')

  const ann = await createAnnouncement({
    title: `Cancelled: ${name}`,
    body,
    audience: ANNOUNCEMENT_AUDIENCE.STUDENTS,
    eventId: id,
    createdBy,
    isPublished: true,
  })

  // Full Stripe refunds for paid registrations (sandbox); ignore if functions unavailable
  let refunds = null
  try {
    refunds = await refundEventPayments(id)
  } catch {
    refunds = null
  }

  return {
    data,
    error: ann.error || refunds?.error || null,
    announcement: ann.data,
    refunds: refunds?.data || null,
  }
}

export async function deleteEvent(id) {
  const { error } = await supabase.from(TABLES.EVENTS).delete().eq('id', id)
  return { error }
}

const CHECKIN_META_SELECT =
  'id, title, event_date, event_time, event_end_time, venue, status, checkin_token, organizer_id'

/** Load event fields needed for station QR (does not touch listEvents select). */
export async function getEventCheckinMeta(eventId) {
  if (!eventId) return { data: null, error: { message: 'Missing event id' } }
  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .select(CHECKIN_META_SELECT)
    .eq('id', eventId)
    .maybeSingle()

  if (error) {
    if (/checkin_token|column/i.test(error.message || '')) {
      return {
        data: null,
        error: { message: 'Run supabase/eventsphere-station-checkin.sql in Supabase' },
      }
    }
    return { data: null, error }
  }
  if (!data) return { data: null, error: { message: 'Event not found' } }
  return { data, error: null }
}

/** Ensure a checkin_token exists; organizer regenerates when rotate=true. */
export async function ensureEventCheckinToken(eventId, { rotate = false } = {}) {
  const { data: current, error: curErr } = await getEventCheckinMeta(eventId)
  if (curErr) return { data: null, error: curErr }

  if (current.checkin_token && !rotate) {
    return { data: current, error: null, created: false }
  }

  const token = generateCheckinToken()
  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .update({ checkin_token: token })
    .eq('id', eventId)
    .select(CHECKIN_META_SELECT)
    .single()

  if (error) {
    if (/checkin_token|column/i.test(error.message || '')) {
      return {
        data: null,
        error: { message: 'Run supabase/eventsphere-station-checkin.sql in Supabase' },
      }
    }
    return { data: null, error }
  }
  return { data, error: null, created: true }
}

