import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase keys.',
  )
}

/**
 * Per-browser-tab auth storage key.
 * Real multi-login: Tab A = student, Tab B = organizer, Tab C = admin —
 * sessions no longer overwrite each other (localStorage was shared before).
 */
function authStorageKey() {
  if (typeof window === 'undefined') return 'eventsphere-auth'
  const TAB_ID = 'eventsphere_tab_id'
  let tabId = window.sessionStorage.getItem(TAB_ID)
  if (!tabId) {
    tabId =
      (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
      `tab_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    window.sessionStorage.setItem(TAB_ID, tabId)
  }
  return `eventsphere-auth-${tabId}`
}

const authOptions =
  typeof window === 'undefined'
    ? {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    : {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: authStorageKey(),
      }

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  { auth: authOptions },
)

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
