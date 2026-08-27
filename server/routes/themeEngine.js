/**
 * Campus-wide theme token engine (platform_settings.theme_engine).
 */
import { supabase } from '../../src/lib/supabase.js'
import {
  DEFAULT_THEME_ENGINE,
  normalizeThemeEngine,
  THEME_ENGINE_SETTINGS_KEY,
} from '../../src/lib/themeEngine.js'

export { THEME_ENGINE_SETTINGS_KEY }

export async function getThemeEngineSettings() {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value, updated_at')
    .eq('key', THEME_ENGINE_SETTINGS_KEY)
    .maybeSingle()

  if (error) {
    return { data: normalizeThemeEngine(DEFAULT_THEME_ENGINE), error }
  }

  if (!data?.value) {
    return { data: normalizeThemeEngine(DEFAULT_THEME_ENGINE), error: null }
  }

  return {
    data: normalizeThemeEngine(data.value),
    error: null,
    updatedAt: data.updated_at,
  }
}

export async function saveThemeEngineSettings(config) {
  const value = normalizeThemeEngine(config)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('platform_settings')
    .upsert(
      {
        key: THEME_ENGINE_SETTINGS_KEY,
        value,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      },
      { onConflict: 'key' },
    )
    .select('value, updated_at')
    .single()

  if (error) return { data: null, error }
  return {
    data: normalizeThemeEngine(data?.value || value),
    error: null,
    updatedAt: data?.updated_at,
  }
}
