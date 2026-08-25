/**
 * Campus mascot library + platform mascot settings (Supabase).
 */
import { supabase } from '../../src/lib/supabase.js'
import { CAMPUS_CHARACTERS } from '../../src/constants/campusCharacters.js'

const SETTINGS_KEY = 'mascot_experience'
const BUILTIN_SLUGS = ['hero', 'banner', 'robot', 'camera']
const BUILTIN_FALLBACK = BUILTIN_SLUGS.map((slug, i) => ({
  id: slug,
  slug,
  label: CAMPUS_CHARACTERS[slug]?.label || slug,
  image_url: CAMPUS_CHARACTERS[slug]?.src || '',
  enabled: true,
  sort_order: (i + 1) * 10,
  is_builtin: true,
}))

function mapMascotRow(row) {
  if (!row) return null
  const slug = row.slug || row.id
  return {
    id: slug,
    slug,
    label: row.label,
    src: row.image_url,
    image_url: row.image_url,
    enabled: row.enabled !== false,
    sort_order: row.sort_order ?? 0,
    is_builtin: Boolean(row.is_builtin),
    db_id: row.id,
  }
}

export function fallbackCampusMascots() {
  return BUILTIN_FALLBACK.map((m) => ({
    id: m.slug,
    slug: m.slug,
    label: m.label,
    src: m.image_url,
    image_url: m.image_url,
    enabled: true,
    sort_order: m.sort_order,
    is_builtin: true,
  }))
}

/** Public library for vibe chip — enabled mascots only. */
export async function listCampusMascots({ includeDisabled = false } = {}) {
  let q = supabase
    .from('campus_mascots')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true })

  if (!includeDisabled) q = q.eq('enabled', true)

  const { data, error } = await q
  if (error) {
    return { data: fallbackCampusMascots(), error }
  }
  if (!data?.length) {
    return { data: fallbackCampusMascots(), error: null }
  }
  return { data: data.map(mapMascotRow), error: null }
}

export async function createCampusMascot({ label, imageUrl, slug, enabled = true, sortOrder = 50 }) {
  const safeSlug =
    slug ||
    String(label || 'mascot')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)

  const { data, error } = await supabase
    .from('campus_mascots')
    .insert({
      slug: safeSlug,
      label: String(label || 'Campus mascot').trim(),
      image_url: imageUrl,
      enabled: Boolean(enabled),
      sort_order: Number(sortOrder) || 50,
      is_builtin: false,
    })
    .select('*')
    .single()

  return { data: mapMascotRow(data), error }
}

export async function updateCampusMascot(id, patch) {
  const payload = { updated_at: new Date().toISOString() }
  if (patch.label != null) payload.label = String(patch.label).trim()
  if (patch.imageUrl != null) payload.image_url = patch.imageUrl
  if (patch.enabled != null) payload.enabled = Boolean(patch.enabled)
  if (patch.sortOrder != null) payload.sort_order = Number(patch.sortOrder) || 0

  const { data, error } = await supabase
    .from('campus_mascots')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  return { data: mapMascotRow(data), error }
}

export async function deleteCampusMascot(id) {
  const { error } = await supabase.from('campus_mascots').delete().eq('id', id).eq('is_builtin', false)
  return { error }
}

export async function getMascotExperienceSettings() {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()

  if (error || !data?.value) {
    return {
      data: { student_upload_enabled: true, max_upload_mb: 2 },
      error,
    }
  }

  return {
    data: {
      student_upload_enabled: data.value.student_upload_enabled !== false,
      max_upload_mb: Math.min(5, Math.max(1, Number(data.value.max_upload_mb) || 2)),
    },
    error: null,
  }
}

export async function updateMascotExperienceSettings(patch) {
  const current = (await getMascotExperienceSettings()).data
  const value = {
    student_upload_enabled:
      patch.student_upload_enabled != null
        ? Boolean(patch.student_upload_enabled)
        : current.student_upload_enabled,
    max_upload_mb:
      patch.max_upload_mb != null
        ? Math.min(5, Math.max(1, Number(patch.max_upload_mb) || 2))
        : current.max_upload_mb,
  }

  const { data, error } = await supabase
    .from('platform_settings')
    .upsert({ key: SETTINGS_KEY, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select('value')
    .single()

  return { data: data?.value || value, error }
}

export async function getMyStudentMascotPref() {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) return { data: null, error: authErr || { message: 'Not signed in' } }

  const { data, error } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return { data: null, error }
  return { data: data?.preferences?.student_mascot ?? null, error: null }
}

export async function saveMyStudentMascotPref(pref) {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) return { data: null, error: authErr || { message: 'Not signed in' } }

  const { data: existing, error: readErr } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .maybeSingle()

  if (readErr) return { data: null, error: readErr }

  const preferences = {
    ...(existing?.preferences || {}),
    student_mascot: pref,
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ preferences })
    .eq('id', user.id)
    .select('preferences')
    .single()

  return { data: data?.preferences?.student_mascot ?? pref, error }
}
