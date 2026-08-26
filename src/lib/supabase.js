import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase keys.',
  )
}

/**
 * True multi-login across tabs (student / organizer / admin at once).
 *
 * Why localStorage alone fails: one shared Supabase session for the whole origin.
 * Why "tab id in sessionStorage + localStorage" still failed: Chrome clones
 * sessionStorage when you open a tab from another tab, so both tabs kept the
 * same storageKey → BroadcastChannel synced SIGNED_IN across them.
 *
 * Fix:
 * 1) Auth tokens live in sessionStorage (not shared after the initial clone).
 * 2) storageKey is unique per live tab (isolates Supabase BroadcastChannel).
 * 3) Clone detection via a short-lived localStorage heartbeat lock.
 */
function resolveTabScopedAuthKey() {
  if (typeof window === 'undefined') return 'eventsphere-auth'

  const TAB_ID_KEY = 'eventsphere_tab_id'
  const lockKeyFor = (id) => `eventsphere_tab_lock:${id}`

  let tabId = window.sessionStorage.getItem(TAB_ID_KEY)
  if (!tabId) {
    tabId =
      (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
      `tab_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    window.sessionStorage.setItem(TAB_ID_KEY, tabId)
  } else {
    try {
      const lock = window.localStorage.getItem(lockKeyFor(tabId))
      if (lock) {
        const age = Date.now() - Number(lock)
        // Another tab is still heartbeating this id → this context was cloned.
        if (Number.isFinite(age) && age >= 0 && age < 2500) {
          tabId =
            (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
            `tab_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
          window.sessionStorage.setItem(TAB_ID_KEY, tabId)
        }
      }
    } catch {
      /* private mode / blocked storage */
    }
  }

  const beat = () => {
    try {
      window.localStorage.setItem(lockKeyFor(tabId), String(Date.now()))
    } catch {
      /* ignore */
    }
  }
  beat()
  window.setInterval(beat, 1000)
  window.addEventListener('pagehide', () => {
    try {
      window.localStorage.removeItem(lockKeyFor(tabId))
    } catch {
      /* ignore */
    }
  })

  return `eventsphere-auth-${tabId}`
}

function scrubLegacySharedAuthKeys() {
  if (typeof window === 'undefined') return
  try {
    // Old shared default keys caused every tab to read the same session.
    const remove = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i)
      if (!k) continue
      if (k.startsWith('sb-') && k.includes('auth-token')) remove.push(k)
      if (k === 'eventsphere-auth') remove.push(k)
      // Previous attempt stored per-tab sessions in localStorage — drop orphans
      if (k.startsWith('eventsphere-auth-')) remove.push(k)
    }
    remove.forEach((k) => window.localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

/**
 * Supabase Auth broadcasts SIGNED_IN on BroadcastChannel(storageKey).
 * Mute that channel name family so one tab's login never overwrites another.
 */
function muteAuthBroadcastChannels() {
  if (typeof window === 'undefined' || !window.BroadcastChannel) return
  if (window.__ES_AUTH_BC_MUTED__) return
  window.__ES_AUTH_BC_MUTED__ = true

  const Original = window.BroadcastChannel
  window.BroadcastChannel = function BroadcastChannel(name) {
    const channel = new Original(name)
    if (typeof name === 'string' && name.startsWith('eventsphere-auth')) {
      channel.postMessage = function postMessage() {
        /* no cross-tab auth sync */
      }
    }
    return channel
  }
  window.BroadcastChannel.prototype = Original.prototype
}

const authOptions =
  typeof window === 'undefined'
    ? {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    : (() => {
        scrubLegacySharedAuthKeys()
        muteAuthBroadcastChannels()
        return {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Per-tab bucket — not origin-wide localStorage
          storage: window.sessionStorage,
          // Unique key ⇒ unique BroadcastChannel ⇒ no cross-tab login sync
          storageKey: resolveTabScopedAuthKey(),
        }
      })()

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  { auth: authOptions },
)

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
