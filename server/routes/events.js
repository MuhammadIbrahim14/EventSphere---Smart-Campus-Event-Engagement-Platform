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

const EVENT_SELECT = `
  id, title, description, category, event_date, event_time, event_end_time, venue, venue_id,
  organizer_id, capacity, waitlist_enabled, registration_requires_approval,
  cancellation_cutoff_at, status, banner_url, symbol, art_class, rules,
  entry_fee, security_deposit, currency, deposit_refund_hours,
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
