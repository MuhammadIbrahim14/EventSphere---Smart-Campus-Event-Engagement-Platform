import { supabase } from '../../src/lib/supabase.js'
import { ATTENDANCE_METHOD, TABLES } from '../../src/constants/domain.js'

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

  // Some RLS setups return no row after upsert even when write succeeded
  if (error) return { data: null, error }
  if (data) return { data, error: null }

  const { data: row, error: readErr } = await supabase
    .from(TABLES.ATTENDANCE)
    .select('*')
    .eq('event_id', eventId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (readErr) return { data: null, error: readErr }
  if (!row) {
    return {
      data: null,
      error: {
        message:
          'Attendance write blocked by database policy. Run supabase/fix-attendance.sql (organizer/admin must be allowed to mark).',
      },
    }
  }
  return { data: row, error: null }
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
