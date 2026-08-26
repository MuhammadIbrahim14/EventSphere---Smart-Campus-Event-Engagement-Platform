/**
 * Ask Organizer Q&A — persist questions, list threads, organizer replies.
 */
import { supabase } from '../../src/lib/supabase.js'
import { TABLES } from '../../src/constants/domain.js'

function friendlyQuestionError(error) {
  if (!error) return null
  const msg = String(error.message || error)
  if (/does not exist|schema cache|Could not find the table/i.test(msg)) {
    return {
      message:
        'Ask Organizer table missing. Run supabase/eventsphere-fix-ask-organizer.sql in Supabase SQL Editor.',
    }
  }
  if (/row-level security|RLS|permission denied|42501/i.test(msg)) {
    return {
      message:
        'Could not save/read questions (RLS). Run supabase/eventsphere-fix-ask-organizer.sql then retry.',
    }
  }
  if (/foreign key|23503/i.test(msg)) {
    return { message: 'Invalid event or profile for this question.' }
  }
  return { message: msg }
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) {
    return { user: null, error: { message: 'Please sign in first' } }
  }
  return { user: data.user, error: null }
}

const QUESTION_SELECT =
  'id, event_id, student_id, question, answer, answered_at, answered_by, created_at, events:event_id ( id, title, organizer_id )'

const QUESTION_SELECT_WITH_PROFILE = `${QUESTION_SELECT}, profiles:student_id ( full_name, email )`

/** Student asks organizer — always uses auth.uid() as student_id. */
export async function askOrganizer({ eventId, studentId, question }) {
  const text = String(question || '').trim()
  if (!eventId || !text) {
    return { data: null, error: { message: 'Question required' } }
  }

  const { user, error: authError } = await requireUser()
  if (authError) return { data: null, error: authError }

  // Never trust a mismatched client id — RLS requires student_id = auth.uid()
  if (studentId && studentId !== user.id) {
    return { data: null, error: { message: 'Session mismatch — refresh and try again' } }
  }

  const { data, error } = await supabase
    .from(TABLES.EVENT_QUESTIONS)
    .insert({
      event_id: eventId,
      student_id: user.id,
      question: text,
    })
    .select(QUESTION_SELECT)
    .single()

  if (error) return { data: null, error: friendlyQuestionError(error) }

  return { data, error: null }
}

export async function listQuestionsForEvent(eventId, { studentId } = {}) {
  if (!eventId) return { data: [], error: null }
  let query = supabase
    .from(TABLES.EVENT_QUESTIONS)
    .select(QUESTION_SELECT_WITH_PROFILE)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  if (studentId) query = query.eq('student_id', studentId)

  let { data, error } = await query
  if (error && /profiles|relationship|embed/i.test(error.message || '')) {
    const fallback = await supabase
      .from(TABLES.EVENT_QUESTIONS)
      .select(QUESTION_SELECT)
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
    if (studentId) {
      return {
        data: (fallback.data || []).filter((r) => r.student_id === studentId),
        error: fallback.error ? friendlyQuestionError(fallback.error) : null,
      }
    }
    return {
      data: fallback.data || [],
      error: fallback.error ? friendlyQuestionError(fallback.error) : null,
    }
  }
  return { data: data || [], error: error ? friendlyQuestionError(error) : null }
}

/**
 * Organizer inbox — RLS returns readable rows; keep only events this user owns.
 * Optional organizerEventIds further narrows when provided.
 */
export async function listOrganizerQuestions(organizerEventIds = [], organizerId = null) {
  const { user, error: authError } = await requireUser()
  if (authError) return { data: [], error: authError }
  const oid = organizerId || user.id

  let query = supabase
    .from(TABLES.EVENT_QUESTIONS)
    .select(QUESTION_SELECT_WITH_PROFILE)
    .order('created_at', { ascending: false })

  if (Array.isArray(organizerEventIds) && organizerEventIds.length) {
    query = query.in('event_id', organizerEventIds)
  }

  let { data, error } = await query

  if (error && /profiles|relationship|embed/i.test(error.message || '')) {
    query = supabase
      .from(TABLES.EVENT_QUESTIONS)
      .select(QUESTION_SELECT)
      .order('created_at', { ascending: false })
    if (Array.isArray(organizerEventIds) && organizerEventIds.length) {
      query = query.in('event_id', organizerEventIds)
    }
    ;({ data, error } = await query)
  }

  if (error) return { data: [], error: friendlyQuestionError(error) }

  let rows = (data || [])
    .map((row) => ({
      ...row,
      events: Array.isArray(row.events) ? row.events[0] : row.events,
      profiles: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
    }))
    .filter((row) => {
      const owner = row.events?.organizer_id
      if (owner) return owner === oid
      if (Array.isArray(organizerEventIds) && organizerEventIds.length) {
        return organizerEventIds.includes(row.event_id)
      }
      return true
    })

  // Hydrate name/email if embed was empty (WhatsApp chat list needs both)
  const needProfile = [
    ...new Set(
      rows
        .filter((r) => !r.profiles?.full_name && !r.profiles?.email)
        .map((r) => r.student_id)
        .filter(Boolean),
    ),
  ]
  if (needProfile.length) {
    const { data: profiles } = await supabase
      .from(TABLES.PROFILES)
      .select('id, full_name, email')
      .in('id', needProfile)
    const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
    rows = rows.map((r) => ({
      ...r,
      profiles: r.profiles?.full_name || r.profiles?.email ? r.profiles : byId[r.student_id] || r.profiles,
    }))
  }

  return { data: rows, error: null }
}

export async function listMyQuestions(studentId) {
  const { user, error: authError } = await requireUser()
  if (authError) return { data: [], error: authError }
  const sid = studentId || user.id

  const { data, error } = await supabase
    .from(TABLES.EVENT_QUESTIONS)
    .select(QUESTION_SELECT)
    .eq('student_id', sid)
    .order('created_at', { ascending: false })

  return { data: data || [], error: error ? friendlyQuestionError(error) : null }
}

export async function replyToQuestion({ questionId, answer, answeredBy, studentId, eventTitle }) {
  const text = String(answer || '').trim()
  if (!questionId || !text) {
    return { data: null, error: { message: 'Reply required' } }
  }

  const { user, error: authError } = await requireUser()
  if (authError) return { data: null, error: authError }

  const { data, error } = await supabase
    .from(TABLES.EVENT_QUESTIONS)
    .update({
      answer: text,
      answered_at: new Date().toISOString(),
      answered_by: answeredBy || user.id,
    })
    .eq('id', questionId)
    .select(QUESTION_SELECT)
    .single()

  if (error) return { data: null, error: friendlyQuestionError(error) }

  const targetStudent = studentId || data?.student_id
  if (targetStudent) {
    await supabase.from(TABLES.STUDENT_NOTICES).insert({
      user_id: targetStudent,
      event_id: data?.event_id || null,
      kind: 'organizer_reply',
      title: 'Organizer replied',
      body: `Reply on ${eventTitle || data?.events?.title || 'your event'}: ${text.slice(0, 180)}`,
      meta: { question_id: questionId },
    })
  }

  return { data, error: null }
}
