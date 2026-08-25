import { supabase } from '../../src/lib/supabase.js'
import { TABLES } from '../../src/constants/domain.js'

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
    .select('*, profiles:student_id ( full_name, email )')
    .eq('event_id', eventId)
  return { data, error }
}

export async function issueCertificate(payload) {
  const { data, error } = await supabase
    .from(TABLES.CERTIFICATES)
    .upsert(
      {
        event_id: payload.eventId,
        student_id: payload.studentId,
        certificate_url: payload.certificateUrl || null,
        fee_acknowledged: Boolean(payload.feeAcknowledged),
        fee_amount: payload.feeAmount ?? null,
        fee_details: payload.feeDetails || '',
        issued_on: payload.issuedOn || new Date().toISOString(),
      },
      { onConflict: 'event_id,student_id' },
    )
    .select()
    .single()
  return { data, error }
}

export async function acknowledgeCertificateFee({ eventId, studentId, feeDetails, feeAmount }) {
  const { data, error } = await supabase
    .from(TABLES.CERTIFICATES)
    .upsert(
      {
        event_id: eventId,
        student_id: studentId,
        fee_acknowledged: true,
        fee_details: feeDetails || '',
        fee_amount: feeAmount ?? null,
      },
      { onConflict: 'event_id,student_id' },
    )
    .select()
    .single()
  return { data, error }
}
