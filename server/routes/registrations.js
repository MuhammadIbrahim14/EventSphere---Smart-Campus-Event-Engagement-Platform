/**
 * Registrations API — uses capacity-safe RPCs (no hardcoded overbook).
 * Falls back to direct insert only if the RPC is missing from the database.
 * Student pool = events.capacity; guest pool = events.public_capacity.
 */
import { supabase } from '../../src/lib/supabase.js'
import { EVENT_STATUS, REGISTRATION_STATUS, RPC, TABLES } from '../../src/constants/domain.js'
import { ROLES } from '../../src/constants/roles.js'
import { mapRegistrationRowToUi, isRegistrationClosed } from '../../src/lib/eventMappers.js'

function normalizeRpcRow(data) {
  if (!data) return null
  if (Array.isArray(data)) return data[0] || null
  return data
}

function rpcMissing(error) {
  const msg = String(error?.message || error?.details || '')
  return /could not find the function|schema cache|does not exist/i.test(msg)
}

async function resolveReferrerId(referralCode) {
  const normalized = String(referralCode || '')
    .trim()
    .toUpperCase()
  if (!normalized) return { id: null, error: null }
  const { data, error } = await supabase
    .from(TABLES.PROFILES)
    .select('id')
    .eq('referral_code', normalized)
    .maybeSingle()
  if (error) return { id: null, error }
  if (!data) return { id: null, error: { message: 'Invalid referral code' } }
  return { id: data.id, error: null }
}

async function registerViaInsert(eventId, { referralCode } = {}) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) {
    return { data: null, error: userErr || { message: 'Sign in required' } }
  }

  await supabase.rpc('ensure_my_profile')

  const { data: profile } = await supabase
    .from(TABLES.PROFILES)
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  const isGuest = String(profile?.role || '').toLowerCase() === ROLES.GUEST

  const { data: ev, error: evErr } = await supabase
    .from(TABLES.EVENTS)
    .select(
      'id, status, capacity, public_capacity, waitlist_enabled, registration_requires_approval, entry_fee, security_deposit, registration_closes_at',
    )
    .eq('id', eventId)
    .maybeSingle()

  if (evErr) return { data: null, error: evErr }
  if (!ev) return { data: null, error: { message: 'Event not found' } }
  if (ev.status !== EVENT_STATUS.APPROVED) {
    return {
      data: null,
      error: { message: 'Event is not open for registration (needs admin approval)' },
    }
  }
  if (isRegistrationClosed(ev)) {
    return { data: null, error: { message: 'Registration is closed for this event' } }
  }
  if (Number(ev.entry_fee || 0) > 0 || Number(ev.security_deposit || 0) > 0) {
    return {
      data: null,
      error: { message: 'This event requires payment. Use Pay with Stripe.' },
    }
  }

  if (isGuest && Number(ev.public_capacity || 0) <= 0) {
    return {
      data: null,
      error: { message: 'This event is for campus students only. Sign in with a campus account.' },
    }
  }

  const ref = await resolveReferrerId(referralCode)
  if (ref.error) return { data: null, error: ref.error }
  if (ref.id && ref.id === user.id) {
    return { data: null, error: { message: 'Cannot refer yourself' } }
  }

  const { data: existing } = await supabase
    .from(TABLES.REGISTRATIONS)
    .select('*')
    .eq('event_id', eventId)
    .eq('student_id', user.id)
    .maybeSingle()

  if (
    existing &&
    [
      REGISTRATION_STATUS.CONFIRMED,
      REGISTRATION_STATUS.WAITLIST,
      REGISTRATION_STATUS.PENDING,
      REGISTRATION_STATUS.PENDING_PAYMENT,
    ].includes(existing.status)
  ) {
    return { data: mapRegistrationRowToUi(existing), error: null }
  }

  let seats = null
  const seatsRpc = isGuest ? RPC.PUBLIC_SEATS_AVAILABLE : RPC.SEATS_AVAILABLE
  const seatsRes = await supabase.rpc(seatsRpc, { p_event_id: eventId })
  if (!seatsRes.error) seats = seatsRes.data

  let nextStatus = REGISTRATION_STATUS.CONFIRMED
  if (seats != null && Number(seats) <= 0) {
    if (ev.waitlist_enabled !== false) nextStatus = REGISTRATION_STATUS.WAITLIST
    else return { data: null, error: { message: 'Event is full' } }
  }
  if (
    ev.registration_requires_approval &&
    nextStatus === REGISTRATION_STATUS.CONFIRMED
  ) {
    nextStatus = REGISTRATION_STATUS.PENDING
  }

  const payload = {
    event_id: eventId,
    student_id: user.id,
    status: nextStatus,
    registered_on: new Date().toISOString(),
    cancelled_on: null,
  }
  if (ref.id) payload.referred_by = ref.id

  const { data: row, error: insErr } = await supabase
    .from(TABLES.REGISTRATIONS)
    .upsert(payload, { onConflict: 'event_id,student_id' })
    .select('*')
    .single()

  return { data: mapRegistrationRowToUi(row), error: insErr }
}

export async function registerForEvent(eventId, { referralCode } = {}) {
  if (!eventId) {
    return { data: null, error: { message: 'Missing event id' } }
  }

  await supabase.rpc('ensure_my_profile')

  const { data: preview } = await supabase
    .from(TABLES.EVENTS)
    .select('registration_closes_at, public_capacity')
    .eq('id', eventId)
    .maybeSingle()
  if (isRegistrationClosed(preview)) {
    return { data: null, error: { message: 'Registration is closed for this event' } }
  }

  // Prefer RPC (no referral_code arg yet) then patch referred_by if needed
  const { data, error } = await supabase.rpc(RPC.REGISTER_FOR_EVENT, {
    p_event_id: eventId,
  })

  if (!error) {
    const row = normalizeRpcRow(data)
    if (referralCode && row?.id) {
      const ref = await resolveReferrerId(referralCode)
      if (!ref.error && ref.id) {
        await supabase
          .from(TABLES.REGISTRATIONS)
          .update({ referred_by: ref.id })
          .eq('id', row.id)
          .eq('student_id', row.student_id)
        row.referred_by = ref.id
      }
    }
    return { data: mapRegistrationRowToUi(row), error: null }
  }

  if (rpcMissing(error)) {
    return registerViaInsert(eventId, { referralCode })
  }

  return { data: null, error }
}

export async function cancelRegistration(eventId) {
  if (!eventId) {
    return { data: null, error: { message: 'Missing event id' } }
  }

  const { data, error } = await supabase.rpc(RPC.CANCEL_REGISTRATION, {
    p_event_id: eventId,
  })

  if (!error) {
    return { data: mapRegistrationRowToUi(normalizeRpcRow(data)), error: null }
  }

  if (!rpcMissing(error)) {
    return { data: null, error }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Sign in required' } }

  const { data: row, error: updErr } = await supabase
    .from(TABLES.REGISTRATIONS)
    .update({
      status: REGISTRATION_STATUS.CANCELLED,
      cancelled_on: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .eq('student_id', user.id)
    .select('*')
    .maybeSingle()

  return { data: mapRegistrationRowToUi(row), error: updErr }
}

export async function listMyRegistrations(studentId) {
  const { data, error } = await supabase
    .from(TABLES.REGISTRATIONS)
    .select('*')
    .eq('student_id', studentId)
    .order('registered_on', { ascending: false })

  return {
    data: (data || []).map(mapRegistrationRowToUi),
    error,
  }
}

export async function listAllRegistrations() {
  const { data, error } = await supabase
    .from(TABLES.REGISTRATIONS)
    .select(
      '*, profiles:student_id ( full_name, email, department, enrollment_no, role ), events:event_id ( title, organizer_id, profiles:organizer_id ( full_name ) )',
    )
    .order('registered_on', { ascending: false })

  return {
    data: (data || []).map((row) => ({
      ...mapRegistrationRowToUi(row),
      student: row.profiles || null,
      eventTitle: row.events?.title || null,
      organizerName: row.events?.profiles?.full_name || null,
      event: row.events
        ? { title: row.events.title, organizer: row.events.profiles?.full_name }
        : null,
    })),
    error,
  }
}

export async function listEventRegistrations(eventId) {
  const { data, error } = await supabase
    .from(TABLES.REGISTRATIONS)
    .select('*, profiles:student_id ( full_name, email, department, enrollment_no, role )')
    .eq('event_id', eventId)
    .order('registered_on', { ascending: true })

  return {
    data: (data || []).map((row) => ({
      ...mapRegistrationRowToUi(row),
      student: row.profiles || null,
    })),
    error,
  }
}

export async function updateRegistrationStatus(id, status) {
  const { data, error } = await supabase
    .from(TABLES.REGISTRATIONS)
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  return { data: mapRegistrationRowToUi(data), error }
}

export async function getSeatsAvailable(eventId) {
  const { data, error } = await supabase.rpc(RPC.SEATS_AVAILABLE, {
    p_event_id: eventId,
  })
  return { data, error }
}

export async function getPublicSeatsAvailable(eventId) {
  const { data, error } = await supabase.rpc(RPC.PUBLIC_SEATS_AVAILABLE, {
    p_event_id: eventId,
  })
  return { data, error }
}
