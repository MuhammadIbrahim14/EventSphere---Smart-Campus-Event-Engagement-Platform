import { createContext, useContext, useEffect, useState } from 'react'
import { ROLES, normalizeRole } from '../constants/roles'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { syntheticStudentEmail } from '../lib/enrollmentAuth'
import { studentLogin } from '../services/enrollmentAuth'
import { clearMustChangePassword } from '../services/personalEmail'

const AuthContext = createContext(null)

const ENROLLMENT_AUTH_FIELDS =
  'must_change_password, personal_email, personal_email_verified, provisioned, provisioned_at, enrollment_no'

async function mergeEnrollmentAuthFields(profile) {
  if (!profile?.id) return profile
  const { data, error } = await supabase
    .from('profiles')
    .select(ENROLLMENT_AUTH_FIELDS)
    .eq('id', profile.id)
    .maybeSingle()
  if (error || !data) return profile
  return { ...profile, ...data }
}

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
      return await mergeEnrollmentAuthFields(ensured)
    }

    if (ensureError) {
      console.warn('ensure_my_profile RPC:', ensureError.message)
    }

    const { data: mine, error: getError } = await supabase.rpc('get_my_profile')
    if (!getError && mine) {
      return await mergeEnrollmentAuthFields(mine)
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
    if (!isGuestIntent) {
      return {
        data: null,
        error: {
          message:
            'Campus students cannot self-register. Sign in with enrollment, or continue as a public guest.',
        },
      }
    }
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

    // Provisioned students: personal email → synthetic Auth email via Edge
    const edge = await studentLogin({
      mode: 'email',
      identifier: email,
      password,
    })
    if (!edge.error && edge.data?.session) {
      const { error: setErr } = await supabase.auth.setSession({
        access_token: edge.data.session.access_token,
        refresh_token: edge.data.session.refresh_token,
      })
      if (setErr) return { data: null, error: setErr, profile: null }
      setSession(edge.data.session)
      const p = await fetchProfile()
      setProfile(p)
      return { data: { session: edge.data.session, user: edge.data.user }, error: null, profile: p }
    }

    return {
      data: null,
      error: edge.error?.code === 'email_not_linked' ? edge.error : error || edge.error,
      profile: null,
    }
  }

  async function signInWithEnrollment({ enrollmentNo, password }) {
    const email = syntheticStudentEmail(enrollmentNo)
    if (!email) {
      return { data: null, error: { message: 'Enrollment number is required.' }, profile: null }
    }

    // Prefer direct Auth sign-in (works even if Edge not deployed yet)
    const direct = await supabase.auth.signInWithPassword({ email, password })
    if (!direct.error && direct.data?.user) {
      setSession(direct.data.session)
      const p = await fetchProfile()
      setProfile(p)
      return { data: direct.data, error: null, profile: p }
    }

    const edge = await studentLogin({
      mode: 'enrollment',
      identifier: enrollmentNo,
      password,
    })
    if (!edge.error && edge.data?.session) {
      const { error: setErr } = await supabase.auth.setSession({
        access_token: edge.data.session.access_token,
        refresh_token: edge.data.session.refresh_token,
      })
      if (setErr) return { data: null, error: setErr, profile: null }
      setSession(edge.data.session)
      const p = await fetchProfile()
      setProfile(p)
      return { data: { session: edge.data.session, user: edge.data.user }, error: null, profile: p }
    }

    return {
      data: null,
      error: direct.error || edge.error || { message: 'Invalid enrollment or password' },
      profile: null,
    }
  }

  async function completeForcedPasswordChange(newPassword) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { data: null, error }
    const { error: clearErr } = await clearMustChangePassword()
    if (clearErr) {
      console.warn('clear_must_change_password:', clearErr.message)
    }
    const p = await fetchProfile()
    setProfile(p)
    return { data, error: null, profile: p }
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
  const mustChangePassword = Boolean(profile?.must_change_password)

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    isAdmin,
    isOrganizer,
    isPublicGuest,
    isGuest,
    mustChangePassword,
    loading,
    configured: isSupabaseConfigured,
    signUp,
    signIn,
    signInWithEnrollment,
    completeForcedPasswordChange,
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
