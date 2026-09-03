/**
 * Profiles API — directory + self-service identity updates.
 */
import { supabase } from '../../src/lib/supabase.js'

const USERNAME_RE = /^[a-z0-9_]{3,24}$/

/** Fields a user may update on their own profile (never role / wallet / OTP). */
const SELF_EDITABLE = [
  'full_name',
  'username',
  'mobile',
  'department',
  'enrollment_no',
  'avatar_url',
  'bio',
]

export function normalizeUsername(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
  return v || null
}

export function validateUsername(raw) {
  const username = normalizeUsername(raw)
  if (!username) return { ok: true, username: null }
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      username: null,
      error: 'Username must be 3–24 chars: lowercase letters, numbers, underscore',
    }
  }
  return { ok: true, username }
}

/** GET /profiles */
export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

/** PUT /profiles/:id/role */
export async function updateProfileRole(id, role) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

/** Check username availability (case-insensitive; own id excluded). */
export async function isUsernameAvailable(username, excludeUserId) {
  const check = validateUsername(username)
  if (!check.ok) return { available: false, error: { message: check.error } }
  if (!check.username) return { available: true, error: null }

  let query = supabase
    .from('profiles')
    .select('id')
    .eq('username', check.username)
    .limit(1)

  if (excludeUserId) query = query.neq('id', excludeUserId)

  const { data, error } = await query.maybeSingle()
  if (error) return { available: false, error }
  return { available: !data, error: null }
}

/**
 * Update signed-in user's profile.
 * Whitelist only — ignores role, email, wallet_points, etc.
 */
export async function updateMyProfile(patch = {}) {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { data: null, error: authErr || { message: 'Not signed in' } }
  }

  const { data: me, error: meErr } = await supabase
    .from('profiles')
    .select('provisioned')
    .eq('id', user.id)
    .maybeSingle()
  if (meErr) return { data: null, error: meErr }
  const provisioned = Boolean(me?.provisioned)

  const payload = {}
  for (const key of SELF_EDITABLE) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue
    if (key === 'enrollment_no' && provisioned) {
      continue
    }
    let value = patch[key]

    if (key === 'username') {
      const check = validateUsername(value)
      if (!check.ok) return { data: null, error: { message: check.error } }
      value = check.username
      if (value) {
        const avail = await isUsernameAvailable(value, user.id)
        if (avail.error) return { data: null, error: avail.error }
        if (!avail.available) {
          return { data: null, error: { message: 'That username is already taken' } }
        }
      }
    }

    if (key === 'full_name') {
      value = String(value || '').trim()
      if (!value) return { data: null, error: { message: 'Full name is required' } }
      if (value.length > 80) return { data: null, error: { message: 'Full name is too long' } }
    }

    if (key === 'mobile') {
      value = String(value || '').trim()
      if (value && value.length > 20) {
        return { data: null, error: { message: 'Phone number is too long' } }
      }
      value = value || null
    }

    if (key === 'department' || key === 'enrollment_no') {
      value = String(value || '').trim() || null
      if (value && value.length > 80) {
        return { data: null, error: { message: `${key} is too long` } }
      }
    }

    if (key === 'bio') {
      value = String(value || '').trim() || null
      if (value && value.length > 280) {
        return { data: null, error: { message: 'Bio must be 280 characters or less' } }
      }
    }

    if (key === 'avatar_url') {
      value = String(value || '').trim() || null
    }

    payload[key] = value
  }

  if (!Object.keys(payload).length) {
    return { data: null, error: { message: 'No profile fields to update' } }
  }

  payload.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', user.id)
    .select('*')
    .single()

  return { data, error }
}
