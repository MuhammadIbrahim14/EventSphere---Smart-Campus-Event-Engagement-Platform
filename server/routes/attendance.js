import { supabase } from '../../src/lib/supabase.js'
import { ATTENDANCE_METHOD, TABLES } from '../../src/constants/domain.js'
import { evaluateStudentAchievements } from './experience.js'

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
            'Attendance write blocked by database policy. Run supabase/fix-attendance.sql (organizer/admin must be allowed to mark).',
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
