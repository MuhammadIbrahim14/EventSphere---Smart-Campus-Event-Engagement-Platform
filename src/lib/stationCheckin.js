/**
 * Venue station check-in QR (URL posters for Camera / Google Lens).
 * Poster links always point at the public site (Netlify), not localhost.
 */

/** Production site — station QR redirects here after scan. */
export const DEFAULT_PUBLIC_APP_URL = 'https://eventsphere-sceep.netlify.app'

export function getPublicAppOrigin() {
  const fromEnv = String(import.meta.env?.VITE_PUBLIC_APP_URL || '').trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return DEFAULT_PUBLIC_APP_URL
}

export function generateCheckinToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `es${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Absolute check-in URL encoded in the poster QR.
 * Shape: https://eventsphere-sceep.netlify.app/checkin/{eventId}?t={token}
 */
export function buildStationCheckinUrl(eventId, token, origin) {
  if (!eventId || !token) return ''
  const base = String(origin || getPublicAppOrigin()).replace(/\/$/, '')
  return `${base}/checkin/${encodeURIComponent(eventId)}?t=${encodeURIComponent(token)}`
}

export function attendanceMethodLabel(method) {
  const m = String(method || '').toLowerCase()
  if (m === 'station_qr') return 'Station QR'
  if (m === 'qr') return 'Pass QR'
  if (m === 'manual') return 'Manual'
  return method || '—'
}
