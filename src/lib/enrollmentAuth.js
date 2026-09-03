/** Enrollment normalize + synthetic Auth email (must match SQL helpers). */

export const CAMPUS_STUDENT_EMAIL_DOMAIN = 'students.eventsphere.local'

export function normalizeEnrollment(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

export function syntheticStudentEmail(enrollmentNo) {
  const enr = normalizeEnrollment(enrollmentNo)
  if (!enr) return ''
  return `${enr.toLowerCase()}@${CAMPUS_STUDENT_EMAIL_DOMAIN}`
}

export function isSyntheticCampusEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
    .endsWith(`@${CAMPUS_STUDENT_EMAIL_DOMAIN}`)
}

export function looksLikeEmail(value) {
  const v = String(value || '').trim()
  return v.includes('@')
}

/** Real inbox for campus notify — never the synthetic Auth email. */
export function studentContactEmail(profile, user) {
  if (profile?.personal_email_verified && profile?.personal_email) {
    return String(profile.personal_email).trim()
  }
  const email = String(profile?.email || user?.email || '').trim()
  if (!email || isSyntheticCampusEmail(email)) return ''
  return email
}

/** Paid Stripe checkout needs a real receipt inbox (not enrollment@students…). */
export function stripeReceiptEmail(profile, user) {
  return studentContactEmail(profile, user)
}

export function missingStripeReceiptEmailMessage() {
  return 'Link and verify a personal email in Profile before paying — Stripe receipts need a real inbox.'
}
