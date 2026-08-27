import { supabase } from '../../src/lib/supabase.js'
import { TABLES } from '../../src/constants/domain.js'
import { isPublicGuestRole, ROLES } from '../../src/constants/roles.js'

export async function listCertificatesForStudent(studentId) {
  const { data, error } = await supabase
    .from(TABLES.CERTIFICATES)
    .select('*, events:event_id ( title, event_date )')
    .eq('student_id', studentId)
    .order('issued_on', { ascending: false })
  return { data, error }
}

export async function listCertificatesForEvent(eventId) {
  const { data, error } = await supabase
    .from(TABLES.CERTIFICATES)
    .select('*, profiles:student_id ( full_name, email, role )')
    .eq('event_id', eventId)
  return { data, error }
}

/** Certificates are campus-student only — never issue to public guests. */
export async function issueCertificate(payload) {
  const studentId = payload.studentId
  if (!studentId) {
    return { data: null, error: { message: 'Missing student id' } }
  }

  const { data: profile, error: profileErr } = await supabase
    .from(TABLES.PROFILES)
    .select('id, role')
    .eq('id', studentId)
    .maybeSingle()

  if (profileErr) return { data: null, error: profileErr }
  if (!profile) {
    return { data: null, error: { message: 'Attendee profile not found' } }
  }
  if (isPublicGuestRole(profile.role) || profile.role === ROLES.GUEST) {
    return {
      data: null,
      error: { message: 'Certificates are for campus students only — not public guests.' },
    }
  }

  const { data, error } = await supabase
    .from(TABLES.CERTIFICATES)
    .upsert(
      {
        event_id: payload.eventId,
        student_id: studentId,
        certificate_url: payload.certificateUrl || null,
        fee_acknowledged: false,
        fee_amount: null,
        fee_details: '',
        issued_on: payload.issuedOn || new Date().toISOString(),
      },
      { onConflict: 'event_id,student_id' },
    )
    .select()
    .single()
  return { data, error }
}
