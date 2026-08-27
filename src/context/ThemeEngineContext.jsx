import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  DEFAULT_THEME_ENGINE,
  applyThemeEngine,
  loadThemeEngine,
  normalizeThemeEngine,
  saveThemeEngineLocal,
  themeFromPreset,
} from '@/lib/themeEngine'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  THEME_ENGINE_SETTINGS_KEY,
  getThemeEngineSettings,
  saveThemeEngineSettings,
} from '@/services/themeEngine'

const ThemeEngineContext = createContext(null)
const REMOTE_SAVE_DEBOUNCE_MS = 500

export function ThemeEngineProvider({ children }) {
  const { isAdmin } = useAuth()
  const [config, setConfigState] = useState(() => loadThemeEngine())
  const [syncStatus, setSyncStatus] = useState(() =>
    isSupabaseConfigured ? 'loading' : 'local',
  )
  const [syncError, setSyncError] = useState(null)

  const remoteReadyRef = useRef(!isSupabaseConfigured)
  const skipRemoteWriteRef = useRef(false)
  const saveTimerRef = useRef(null)
  const latestConfigRef = useRef(config)
  const isAdminRef = useRef(isAdmin)

  latestConfigRef.current = config
  isAdminRef.current = isAdmin

  const flushRemoteSave = useCallback(async (nextConfig) => {
    if (!isSupabaseConfigured || !remoteReadyRef.current) return { error: null }
    setSyncStatus('saving')
    setSyncError(null)
    const { error } = await saveThemeEngineSettings(nextConfig)
    if (error) {
      setSyncStatus('error')
      setSyncError(error.message || 'Could not save campus theme')
      return { error }
    }
    setSyncStatus('synced')
    setSyncError(null)
    return { error: null }
  }, [])

  const scheduleRemoteSave = useCallback(
    (nextConfig) => {
      if (!isSupabaseConfigured || !remoteReadyRef.current || !isAdminRef.current) return
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => {
        flushRemoteSave(nextConfig)
      }, REMOTE_SAVE_DEBOUNCE_MS)
    },
    [flushRemoteSave],
  )

  useEffect(() => {
    const next = normalizeThemeEngine(config)
    applyThemeEngine(next)
    saveThemeEngineLocal(next)
    if (!skipRemoteWriteRef.current) {
      scheduleRemoteSave(next)
    }
    skipRemoteWriteRef.current = false
  }, [config, scheduleRemoteSave])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    let cancelled = false

    const hydrate = async () => {
      setSyncStatus('loading')
      const { data, error } = await getThemeEngineSettings()
      if (cancelled) return

      if (error) {
        remoteReadyRef.current = true
        setSyncStatus('error')
        setSyncError(error.message || 'Could not load campus theme')
        return
      }

      remoteReadyRef.current = true
      skipRemoteWriteRef.current = true
      setConfigState(normalizeThemeEngine(data))
      setSyncStatus('synced')
      setSyncError(null)
    }

    hydrate()

    const channel = supabase
      .channel('platform-theme-engine')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'platform_settings',
          filter: `key=eq.${THEME_ENGINE_SETTINGS_KEY}`,
        },
        (payload) => {
          const raw = payload.new?.value
          if (!raw) return
          const next = normalizeThemeEngine(raw)
          const current = normalizeThemeEngine(latestConfigRef.current)
          if (JSON.stringify(next) === JSON.stringify(current)) {
            setSyncStatus('synced')
            return
          }
          skipRemoteWriteRef.current = true
          setConfigState(next)
          setSyncStatus('synced')
          setSyncError(null)
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [])

  const setConfig = useCallback((updater) => {
    setConfigState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      return normalizeThemeEngine(next)
    })
  }, [])

  const updatePaletteColor = useCallback((mode, key, hex) => {
    setConfigState((prev) =>
      normalizeThemeEngine({
        ...prev,
        preset: 'custom',
        [mode]: { ...prev[mode], [key]: hex },
      }),
    )
  }, [])

  const applyPreset = useCallback((presetId) => {
    setConfigState(themeFromPreset(presetId))
  }, [])

  const resetDefaults = useCallback(() => {
    setConfigState(structuredClone(DEFAULT_THEME_ENGINE))
  }, [])

  const persistNow = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    return flushRemoteSave(normalizeThemeEngine(latestConfigRef.current))
  }, [flushRemoteSave])

  const value = useMemo(
    () => ({
      config,
      setConfig,
      updatePaletteColor,
      applyPreset,
      resetDefaults,
      syncStatus,
      syncError,
      persistNow,
    }),
    [
      config,
      setConfig,
      updatePaletteColor,
      applyPreset,
      resetDefaults,
      syncStatus,
      syncError,
      persistNow,
    ],
  )

  return <ThemeEngineContext.Provider value={value}>{children}</ThemeEngineContext.Provider>
}

export function useThemeEngine() {
  const ctx = useContext(ThemeEngineContext)
  if (!ctx) throw new Error('useThemeEngine must be used within ThemeEngineProvider')
  return ctx
}
