import { supabase } from '../../src/lib/supabase.js'
import { TABLES } from '../../src/constants/domain.js'
import { evaluateStudentAchievements } from './experience.js'

export async function submitFeedback(payload) {
  const { data, error } = await supabase
    .from(TABLES.FEEDBACK)
    .upsert(
      {
        event_id: payload.eventId,
        student_id: payload.studentId,
        rating: payload.rating,
        venue_rating: payload.venueRating ?? null,
        coordination_rating: payload.coordinationRating ?? null,
        technical_rating: payload.technicalRating ?? null,
        hospitality_rating: payload.hospitalityRating ?? null,
        comments: payload.comments || '',
      },
      { onConflict: 'event_id,student_id' },
    )
    .select()
    .single()

  if (!error && payload.studentId) {
    await evaluateStudentAchievements(payload.studentId)
  }

  return { data, error }
}

export async function listEventFeedback(eventId) {
  const { data, error } = await supabase
    .from(TABLES.FEEDBACK)
    .select('*, profiles:student_id ( full_name, role )')
    .eq('event_id', eventId)
    .eq('is_hidden', false)
    .order('submitted_on', { ascending: false })
  return { data, error }
}

export async function listMyFeedback(studentId) {
  const { data, error } = await supabase
    .from(TABLES.FEEDBACK)
    .select('*')
    .eq('student_id', studentId)
  return { data, error }
}
