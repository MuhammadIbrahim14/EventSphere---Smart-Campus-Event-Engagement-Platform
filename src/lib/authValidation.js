const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NAME_RE = /^[\p{L}][\p{L}\s'.-]{1,58}$/u
const MOBILE_PK_RE = /^(\+92|0)?3[0-9]{9}$/

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function validatePasswordStrength(password) {
  const p = String(password || '')
  if (!p) return { ok: false, message: 'Password is required.' }
  if (p.length < 8) return { ok: false, message: 'Use at least 8 characters.' }
  if (!/[a-zA-Z]/.test(p)) return { ok: false, message: 'Include at least one letter.' }
  if (!/[0-9]/.test(p)) return { ok: false, message: 'Include at least one number.' }
  if (/\s/.test(p)) return { ok: false, message: 'Password cannot contain spaces.' }
  return { ok: true, message: '' }
}

export function passwordStrengthHints(password) {
  const p = String(password || '')
  return [
    { key: 'len', label: '8+ characters', ok: p.length >= 8 },
    { key: 'letter', label: 'One letter', ok: /[a-zA-Z]/.test(p) },
    { key: 'digit', label: 'One number', ok: /[0-9]/.test(p) },
  ]
}

export function validateLogin({ email, password }) {
  const errors = {}
  const e = normalizeEmail(email)

  if (!e) errors.email = 'Email is required.'
  else if (!EMAIL_RE.test(e)) errors.email = 'Enter a valid email address.'

  if (!password) errors.password = 'Password is required.'
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters.'

  const firstError = errors.email || errors.password || ''
  return { ok: !firstError, errors, firstError }
}

export function validateEnrollmentLogin({ enrollmentNo, password }) {
  const errors = {}
  const enr = String(enrollmentNo || '')
    .trim()
    .replace(/\s+/g, '')

  if (!enr) errors.enrollmentNo = 'Enrollment number is required.'
  else if (enr.length < 3) errors.enrollmentNo = 'Enter a valid enrollment number.'

  if (!password) errors.password = 'Password is required.'
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters.'

  const firstError = errors.enrollmentNo || errors.password || ''
  return { ok: !firstError, errors, firstError }
}

export function validateSignupStep1({ fullName, email, password, intentGuest }) {
  const errors = {}
  const name = String(fullName || '').trim()

  if (!name) errors.fullName = 'Full name is required.'
  else if (name.length < 2) errors.fullName = 'Name must be at least 2 characters.'
  else if (!NAME_RE.test(name)) errors.fullName = 'Use letters only in your name.'

  const e = normalizeEmail(email)
  if (!e) errors.email = 'Email is required.'
  else if (!EMAIL_RE.test(e)) errors.email = 'Enter a valid email address.'

  const pw = validatePasswordStrength(password)
  if (!pw.ok) errors.password = pw.message

  const firstError =
    errors.fullName || errors.email || errors.password || ''
  return { ok: !firstError, errors, firstError }
}

export function validateSignupStep2({ mobile, intentGuest, interests }) {
  const errors = {}
  const phone = String(mobile || '').replace(/[\s-]/g, '')

  if (phone && !MOBILE_PK_RE.test(phone)) {
    errors.mobile = 'Use a valid PK mobile (03XXXXXXXXX).'
  }

  if (!intentGuest && Array.isArray(interests) && interests.length > 8) {
    errors.interests = 'Pick up to 8 interests.'
  }

  const firstError = errors.mobile || errors.interests || ''
  return { ok: !firstError, errors, firstError }
}

export function validateMobile(value, { required = false } = {}) {
  const phone = String(value || '').replace(/[\s-]/g, '')
  if (!phone) {
    return required
      ? { ok: false, message: 'Mobile number is required.' }
      : { ok: true, message: '' }
  }
  if (!MOBILE_PK_RE.test(phone)) {
    return { ok: false, message: 'Use a valid PK mobile (03XXXXXXXXX).' }
  }
  return { ok: true, message: '' }
}
