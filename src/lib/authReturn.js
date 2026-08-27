/**
 * Safe post-auth return path (?next= or sessionStorage).
 */

const STORAGE_KEY = 'es_auth_next'

const ALLOWED_PREFIXES = [
  '/guest',
  '/guest/',
  '/student/',
  '/events',
  '/events/',
  '/checkin/',
  '/organizer/',
  '/admin/',
  '/about',
  '/contact',
  '/faq',
  '/gallery',
  '/sitemap',
]

export function isSafeNextPath(path) {
  if (!path || typeof path !== 'string') return false
  const p = path.trim()
  if (!p.startsWith('/') || p.startsWith('//') || p.includes('://')) return false
  return ALLOWED_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix))
}

export function readNextFromSearch(search = '') {
  try {
    const q = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
    const next = q.get('next')
    return isSafeNextPath(next) ? next : null
  } catch {
    return null
  }
}

export function readIntentFromSearch(search = '') {
  try {
    const q = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
    const intent = String(q.get('intent') || '')
      .trim()
      .toLowerCase()
    return intent === 'guest' ? 'guest' : null
  } catch {
    return null
  }
}

export function stashAuthNext(path) {
  if (!isSafeNextPath(path)) return
  try {
    sessionStorage.setItem(STORAGE_KEY, path)
  } catch {
    /* ignore */
  }
}

export function consumeAuthNext() {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
    return isSafeNextPath(v) ? v : null
  } catch {
    return null
  }
}

export function resolvePostAuthPath(roleHome, search = '') {
  const fromQuery = readNextFromSearch(search)
  if (fromQuery) return fromQuery
  const stashed = consumeAuthNext()
  if (stashed) return stashed
  return roleHome
}

/** Campus student register CTA → signup then student event detail. */
export function campusRegisterHref(eventId) {
  const next = `/student/event/${encodeURIComponent(eventId)}`
  return `/signup?next=${encodeURIComponent(next)}`
}

export function campusLoginHref(eventId) {
  const next = `/student/event/${encodeURIComponent(eventId)}`
  return `/login?next=${encodeURIComponent(next)}`
}

/** Public guest register CTA → guest signup then guest hub (register from hub / event). */
export function publicGuestRegisterHref(eventId) {
  const next = `/guest?event=${encodeURIComponent(eventId)}`
  return `/signup?intent=guest&next=${encodeURIComponent(next)}`
}

export function publicGuestLoginHref(eventId) {
  const next = `/guest?event=${encodeURIComponent(eventId)}`
  return `/login?next=${encodeURIComponent(next)}`
}

/** @deprecated use campusRegisterHref or publicGuestRegisterHref */
export function guestRegisterHref(eventId) {
  return publicGuestRegisterHref(eventId)
}

/** @deprecated use campusLoginHref or publicGuestLoginHref */
export function guestLoginHref(eventId) {
  return publicGuestLoginHref(eventId)
}
