import { supabase } from '../lib/supabase.js'
import { TABLES } from '../constants/domain.js'

export async function listMyNotices({ limit = 40 } = {}) {
  const { data, error } = await supabase
    .from(TABLES.STUDENT_NOTICES || 'student_notices')
    .select('*, events:event_id ( title, event_date, event_time )')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error && /student_notices|schema cache|does not exist/i.test(error.message)) {
    return { data: [], error: null }
  }
  return { data, error }
}

export async function markNoticeEmailSent(id) {
  const { error } = await supabase
    .from(TABLES.STUDENT_NOTICES || 'student_notices')
    .update({ email_sent: true })
    .eq('id', id)
  return { error }
}

export async function markNoticeRead(id) {
  const { error } = await supabase
    .from(TABLES.STUDENT_NOTICES || 'student_notices')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  return { error }
}

export async function createMyNotice({ kind, title, body, eventId, meta }) {
  const { data, error } = await supabase.rpc('create_my_student_notice', {
    p_kind: kind,
    p_title: title,
    p_body: body || '',
    p_event_id: eventId || null,
    p_meta: meta || {},
  })
  if (error && /create_my_student_notice|schema cache|does not exist/i.test(error.message)) {
    // Fallback insert (works once table + RLS exist)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { data: null, error }
    const ins = await supabase
      .from(TABLES.STUDENT_NOTICES || 'student_notices')
      .insert([
        {
          user_id: user.id,
          event_id: eventId || null,
          kind,
          title,
          body: body || '',
          meta: meta || {},
        },
      ])
      .select()
      .maybeSingle()
    return ins
  }
  return { data, error }
}

export async function listMyPayments({ limit = 100 } = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [], error: { message: 'Sign in required' } }

  const { data, error } = await supabase
    .from(TABLES.EVENT_PAYMENTS)
    .select('*, events:event_id ( title, event_date )')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data: data || [], error }
}
