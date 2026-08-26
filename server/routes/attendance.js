import { supabase } from '../../src/lib/supabase.js'
import { ATTENDANCE_METHOD, PAYMENT_STATUS, REGISTRATION_STATUS, TABLES } from '../../src/constants/domain.js'
import { isEventDayOrPast, eventNotStartedMessage } from '../../src/lib/eventDate.js'
import { evaluateStudentAchievements } from './experience.js'

const CHECKIN_ELIGIBLE = new Set([REGISTRATION_STATUS.CONFIRMED])

const PAID_OK = new Set([
  PAYMENT_STATUS.NOT_REQUIRED,
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.PARTIALLY_REFUNDED,
  PAYMENT_STATUS.REFUNDED,
])

export async function markAttendance({
  eventId,
  studentId,
  attended = true,
  method = ATTENDANCE_METHOD.MANUAL,
  markedBy,
}) {
  if (!eventId) return { data: null, error: { message: 'Missing event id' } }
  if (!studentId) return { data: null, error: { message: 'Missing student id' } }

  const payload = {
    event_id: eventId,
    student_id: studentId,
    attended: attended !== false,
    method: method || ATTENDANCE_METHOD.MANUAL,
    marked_by: markedBy || null,
    marked_on: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from(TABLES.ATTENDANCE)
    .upsert(payload, { onConflict: 'event_id,student_id' })
    .select('*')
    .maybeSingle()

  if (error) return { data: null, error }

  let row = data
  if (!row) {
    const { data: reread, error: readErr } = await supabase
      .from(TABLES.ATTENDANCE)
      .select('*')
      .eq('event_id', eventId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (readErr) return { data: null, error: readErr }
    if (!reread) {
      return {
        data: null,
        error: {
          message:
            'Attendance write blocked by database policy. Run supabase/fix-attendance.sql and supabase/eventsphere-station-checkin.sql.',
        },
      }
    }
    row = reread
  }

  if (row.attended) {
    await evaluateStudentAchievements(studentId)
  }

  return { data: row, error: null }
}

/**
 * Student self check-in via venue station QR (URL + token).
 * Does not change organizer personal-pass QR flow.
 */
export async function stationSelfCheckIn({ eventId, token, studentId }) {
  if (!eventId) return { data: null, error: { message: 'Missing event' }, code: 'bad_request' }
  if (!token) return { data: null, error: { message: 'Invalid or missing check-in code' }, code: 'bad_token' }
  if (!studentId) return { data: null, error: { message: 'Sign in required' }, code: 'auth' }

  const { data: ev, error: evErr } = await supabase
    .from(TABLES.EVENTS)
    .select(
      'id, title, event_date, event_time, event_end_time, venue, status, checkin_token, entry_fee, security_deposit',
    )
    .eq('id', eventId)
    .maybeSingle()

  if (evErr) {
    if (/checkin_token|column/i.test(evErr.message || '')) {
      return {
        data: null,
        error: { message: 'Run supabase/eventsphere-station-checkin.sql in Supabase' },
        code: 'sql',
      }
    }
    return { data: null, error: evErr, code: 'db' }
  }
  if (!ev) return { data: null, error: { message: 'Event not found' }, code: 'not_found' }

  if (!ev.checkin_token || String(ev.checkin_token) !== String(token)) {
    return { data: null, error: { message: 'This poster code is invalid or expired' }, code: 'bad_token' }
  }

  if (!isEventDayOrPast(ev.event_date)) {
    return {
      data: null,
      error: { message: eventNotStartedMessage(ev.event_date) },
      code: 'too_early',
      event: ev,
    }
  }

  const { data: reg, error: regErr } = await supabase
    .from(TABLES.REGISTRATIONS)
    .select('id, status, payment_status, fee_amount, deposit_amount')
    .eq('event_id', eventId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (regErr) return { data: null, error: regErr, code: 'db' }
  if (!reg) {
    return {
      data: null,
      error: { message: 'You are not registered for this event' },
      code: 'not_registered',
      event: ev,
    }
  }
  if (!CHECKIN_ELIGIBLE.has(reg.status)) {
    return {
      data: null,
      error: {
        message:
          reg.status === REGISTRATION_STATUS.WAITLIST
            ? 'You are on the waitlist — check-in unlocks after confirmation'
            : reg.status === REGISTRATION_STATUS.PENDING_PAYMENT
              ? 'Complete payment before check-in'
              : `Registration status “${reg.status}” cannot check in`,
      },
      code: 'reg_status',
      event: ev,
      registration: reg,
    }
  }

  const pay = reg.payment_status || PAYMENT_STATUS.NOT_REQUIRED
  if (!PAID_OK.has(pay)) {
    return {
      data: null,
      error: { message: 'Payment required before check-in' },
      code: 'payment',
      event: ev,
      registration: reg,
    }
  }

  const { data: prior } = await supabase
    .from(TABLES.ATTENDANCE)
    .select('*')
    .eq('event_id', eventId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (prior?.attended) {
    return {
      data: prior,
      error: null,
      code: 'already',
      already: true,
      event: ev,
      registration: reg,
    }
  }

  const { data: row, error: markErr } = await markAttendance({
    eventId,
    studentId,
    attended: true,
    method: ATTENDANCE_METHOD.STATION_QR,
    markedBy: studentId,
  })

  if (markErr) return { data: null, error: markErr, code: 'mark_failed', event: ev }

  return {
    data: row,
    error: null,
    code: 'ok',
    already: false,
    event: ev,
    registration: reg,
  }
}

export async function listEventAttendance(eventId) {
  const { data, error } = await supabase
    .from(TABLES.ATTENDANCE)
    .select('*, profiles:student_id ( full_name, email )')
    .eq('event_id', eventId)
    .order('marked_on', { ascending: false })
  return { data, error }
}

export async function getMyAttendance(studentId) {
  const { data, error } = await supabase
    .from(TABLES.ATTENDANCE)
    .select('*')
    .eq('student_id', studentId)
  return { data, error }
}
