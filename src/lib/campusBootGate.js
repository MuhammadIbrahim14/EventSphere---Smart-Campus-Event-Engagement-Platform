export const AUTH_BOOT_PATHS = ['/login', '/signup', '/verify-email', '/forgot-password', '/set-password']

/** Minimum boot overlay time on full reload so the animation is visible. */
export const BOOT_MIN_MS = 850
export const BOOT_MIN_REDUCE_MS = 320

/**
 * Which boot-loader story to tell for the current route.
 * @returns {'auth' | 'guest' | 'campus' | null}
 */
export function getBootLoaderContext(path) {
  if (!path) return null
  if (AUTH_BOOT_PATHS.includes(path)) return 'auth'
  if (path === '/guest' || path.startsWith('/guest/')) return 'guest'
  if (path.startsWith('/student') || path.startsWith('/organizer') || path.startsWith('/admin')) {
    return 'campus'
  }
  return null
}

/** True when the user refreshed or opened the tab directly (not client-side nav). */
export function isDocumentReload() {
  if (typeof window === 'undefined') return false
  try {
    const entry = performance.getEntriesByType('navigation')[0]
    if (entry?.type === 'reload') return true
    if (entry?.type === 'navigate') return true
  } catch {
    /* ignore */
  }
  return true
}

export function resolveBootPhase(bootContext, sessionPending, campusDataPending) {
  if (sessionPending) return bootContext === 'auth' ? 'auth' : 'session'
  if (campusDataPending) return bootContext === 'guest' ? 'guest' : 'campus'
  if (bootContext === 'auth') return 'auth'
  if (bootContext === 'guest') return 'guest'
  return 'campus'
}
