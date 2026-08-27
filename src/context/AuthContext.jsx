import { createContext, useContext, useEffect, useState } from 'react'
import { ROLES, normalizeRole } from '../constants/roles'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile() {
    // Prefer RPC (security definer) so RLS cannot block role read
    const { data: ensured, error: ensureError } = await supabase.rpc(
      'ensure_my_profile',
    )

    if (!ensureError && ensured) {
      return ensured
    }

    if (ensureError) {
      console.warn('ensure_my_profile RPC:', ensureError.message)
    }

    const { data: mine, error: getError } = await supabase.rpc('get_my_profile')
    if (!getError && mine) {
      return mine
    }

    if (getError) {
      console.warn('get_my_profile RPC:', getError.message)
    }

    // Fallback: direct table read
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Failed to load profile:', error.message)
      return null
    }
    return data
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session: current } }) => {
      if (!mounted) return
      setSession(current)
      if (current?.user) {
        const p = await fetchProfile()
        if (mounted) setProfile(p)
      }
      if (mounted) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setTimeout(async () => {
        if (!mounted) return
        if (nextSession?.user) {
          const p = await fetchProfile()
          if (mounted) setProfile(p)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signUp({
    email,
    password,
    fullName,
    mobile,
    department,
    enrollmentNo,
    interests,
    intent,
  }) {
    const isGuestIntent = String(intent || '').toLowerCase() === 'guest'
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          mobile: mobile || '',
          department: department || '',
          enrollment_no: enrollmentNo || '',
          interests: Array.isArray(interests) ? interests : [],
          role: isGuestIntent ? 'guest' : 'user',
        },
      },
    })
    if (!error && data?.user?.id) {
  // Ensure role sticks even if trigger raced / old SQL not yet applied
      // Only attempt when insert may have defaulted to user — admin trigger blocks non-admin updates,
      // so this succeeds only if RLS allows or row still missing role=guest from trigger.
      if (isGuestIntent) {
        try {
          await supabase.rpc('ensure_my_profile')
          await supabase
            .from('profiles')
            .update({ role: ROLES.GUEST })
            .eq('id', data.user.id)
        } catch {
          /* needs eventsphere-guest-mode.sql (handle_new_user + role claim allowlist) */
        }
      }
    }
    if (!error && data?.user?.id && Array.isArray(interests) && interests.length) {
      try {
        const { data: existing } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', data.user.id)
          .maybeSingle()
        await supabase
          .from('profiles')
          .update({
            preferences: {
              ...(existing?.preferences || {}),
              interests,
            },
          })
          .eq('id', data.user.id)
      } catch {
        /* preferences may apply after ensure_my_profile */
      }
    }
    return { data, error }
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (!error && data?.user) {
      setSession(data.session)
      const p = await fetchProfile()
      setProfile(p)
      return { data, error, profile: p }
    }
    return { data, error, profile: null }
  }

  async function signOut() {
    // Local scope: clear this tab's session only (other tabs keep their logins)
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    setSession(null)
    setProfile(null)
    return { error }
  }

  async function refreshProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const p = await fetchProfile()
    setProfile(p)
    return p
  }

  const role = normalizeRole(profile?.role)
  const isAdmin = role === ROLES.ADMIN
  const isOrganizer = role === ROLES.ORGANIZER
  const isPublicGuest = role === ROLES.GUEST
  const isGuest = !session?.user

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    isAdmin,
    isOrganizer,
    isPublicGuest,
    isGuest,
    loading,
    configured: isSupabaseConfigured,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
