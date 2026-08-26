/**
 * Lazy-load Google Maps JS API (Places library) once per session.
 * Requires VITE_GOOGLE_MAPS_API_KEY with Maps JavaScript API + Places API enabled.
 */

const SCRIPT_ID = 'eventsphere-google-maps'

let loadPromise = null
let authFailureHandler = null

const AUTH_FAIL_MSG =
  'Google Maps auth failed. Check: (1) Billing enabled on the Cloud project, (2) Maps JavaScript API + Places API + Geocoding API enabled, (3) API key referrer allows this localhost URL, (4) restart npm run dev after changing .env.'

export function getGoogleMapsApiKey() {
  return String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim()
}

export function hasGoogleMapsApiKey() {
  return Boolean(getGoogleMapsApiKey())
}

/** Call from map UI to surface Google Cloud auth errors (billing / API / referrer). */
export function onGoogleMapsAuthFailure(handler) {
  authFailureHandler = typeof handler === 'function' ? handler : null
  if (typeof window !== 'undefined') {
    window.gm_authFailure = () => {
      authFailureHandler?.(AUTH_FAIL_MSG)
    }
  }
}

export function loadGoogleMaps() {
  const key = getGoogleMapsApiKey()
  if (!key) {
    return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'))
  }

  if (typeof window !== 'undefined' && window.google?.maps?.places) {
    return Promise.resolve(window.google.maps)
  }

  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Document unavailable'))
      return
    }

    // Google calls this global when the key is rejected (billing / APIs / referrers).
    window.gm_authFailure = () => {
      authFailureHandler?.(AUTH_FAIL_MSG)
      loadPromise = null
      reject(new Error(AUTH_FAIL_MSG))
    }

    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.google?.maps) resolve(window.google.maps)
        else reject(new Error('Google Maps failed to load'))
      })
      existing.addEventListener('error', () => reject(new Error('Google Maps script error')))
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly`
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps)
      else reject(new Error('Google Maps unavailable after load'))
    }
    script.onerror = () => {
      loadPromise = null
      reject(new Error('Failed to load Google Maps script'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}
