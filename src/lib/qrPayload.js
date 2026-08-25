/**
 * Attendance QR payload helpers (Phase C).
 * Format: ES|{eventId}|{studentId}|{token}
 * token = registration id when available.
 */

const PREFIX = 'ES'

export function buildAttendancePayload({ eventId, studentId, token }) {
  if (!eventId || !studentId) return ''
  return [PREFIX, eventId, studentId, token || 'pass'].join('|')
}

export function parseAttendancePayload(raw) {
  const text = String(raw || '').trim()
  if (!text) return { error: { message: 'Empty QR code' } }

  const parts = text.includes('|') ? text.split('|') : text.split(':')
  if (parts.length < 3) {
    return { error: { message: 'Invalid QR format. Expected ES|eventId|studentId|token' } }
  }

  let start = 0
  if (parts[0].toUpperCase() === PREFIX) start = 1

  const eventId = parts[start]
  const studentId = parts[start + 1]
  const token = parts[start + 2] || null

  if (!eventId || !studentId) {
    return { error: { message: 'QR missing event or student id' } }
  }

  return { data: { eventId, studentId, token }, error: null }
}
