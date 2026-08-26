/**
 * Campus-wide neon trail settings (platform_settings.neon_trail).
 */
import { supabase } from '../../src/lib/supabase.js'
import {
  DEFAULT_NEON_TRAIL_CONFIG,
  normalizeNeonTrailConfig,
} from '../../src/lib/neonTrail.js'

export const NEON_TRAIL_SETTINGS_KEY = 'neon_trail'

export async function getNeonTrailSettings() {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value, updated_at')
    .eq('key', NEON_TRAIL_SETTINGS_KEY)
    .maybeSingle()

  if (error) {
    return { data: normalizeNeonTrailConfig(DEFAULT_NEON_TRAIL_CONFIG), error }
  }

  if (!data?.value) {
    return { data: normalizeNeonTrailConfig(DEFAULT_NEON_TRAIL_CONFIG), error: null }
  }

  return { data: normalizeNeonTrailConfig(data.value), error: null, updatedAt: data.updated_at }
}

export async function saveNeonTrailSettings(config) {
  const value = normalizeNeonTrailConfig(config)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('platform_settings')
    .upsert(
      {
        key: NEON_TRAIL_SETTINGS_KEY,
        value,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      },
      { onConflict: 'key' },
    )
    .select('value, updated_at')
    .single()

  if (error) return { data: null, error }
  return { data: normalizeNeonTrailConfig(data?.value || value), error: null, updatedAt: data?.updated_at }
}
