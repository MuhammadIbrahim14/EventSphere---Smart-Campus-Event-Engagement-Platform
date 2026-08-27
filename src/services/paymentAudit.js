/**
 * Append-only payment action audit (confirm / refund / forfeit).
 * Failures are non-fatal so payment flows never break.
 */
import { supabase } from '../lib/supabase.js'
import { TABLES } from '../constants/domain.js'

export async function writePaymentAudit({
  action,
  actorId,
  registrationId,
  eventId,
  studentId,
  detail = {},
}) {
  if (!action) return { error: null }
  try {
    const { error } = await supabase.from(TABLES.PAYMENT_AUDIT_LOG || 'payment_audit_log').insert([
      {
        action,
        actor_id: actorId || null,
        registration_id: registrationId || null,
        event_id: eventId || null,
        student_id: studentId || null,
        detail: detail || {},
      },
    ])
    // Table / constraint may be missing until SQL is run — never block payment UX
    if (
      error &&
      /payment_audit_log|schema cache|does not exist|check constraint|violates/i.test(
        error.message || '',
      )
    ) {
      return { error: null }
    }
    return { error }
  } catch {
    return { error: null }
  }
}

export async function listPaymentAudit({ limit = 80 } = {}) {
  const { data, error } = await supabase
    .from(TABLES.PAYMENT_AUDIT_LOG || 'payment_audit_log')
    .select(
      '*, actor:actor_id ( full_name, email, role ), events:event_id ( title ), student:student_id ( full_name, email )',
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error && /payment_audit_log|schema cache|does not exist/i.test(error.message)) {
    return { data: [], error: null }
  }
  return { data, error }
}
