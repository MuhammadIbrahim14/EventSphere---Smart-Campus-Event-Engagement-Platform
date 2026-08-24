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

  async function signUp({ email, password, fullName }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })
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
    const { error } = await supabase.auth.signOut()
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

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    isAdmin,
    isOrganizer,
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
