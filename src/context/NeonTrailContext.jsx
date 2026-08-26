import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  DEFAULT_NEON_TRAIL_CONFIG,
  applyNeonTrailConfig,
  loadNeonTrailConfig,
  normalizeNeonTrailConfig,
  saveNeonTrailConfig,
} from '@/lib/neonTrail'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  NEON_TRAIL_SETTINGS_KEY,
  getNeonTrailSettings,
  saveNeonTrailSettings,
} from '@/services/neonTrail'

const NeonTrailContext = createContext(null)
const REMOTE_SAVE_DEBOUNCE_MS = 450

export function NeonTrailProvider({ children }) {
  const { isAdmin } = useAuth()
  const [config, setConfigState] = useState(() => loadNeonTrailConfig())
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
    const { error } = await saveNeonTrailSettings(nextConfig)
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
    const next = normalizeNeonTrailConfig(config)
    applyNeonTrailConfig(next)
    saveNeonTrailConfig(next)
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
      const { data, error } = await getNeonTrailSettings()
      if (cancelled) return

      if (error) {
        // Keep local cache; still allow admin writes to attempt later.
        remoteReadyRef.current = true
        setSyncStatus('error')
        setSyncError(error.message || 'Could not load campus theme')
        return
      }

      remoteReadyRef.current = true
      skipRemoteWriteRef.current = true
      setConfigState(normalizeNeonTrailConfig(data))
      setSyncStatus('synced')
      setSyncError(null)
    }

    hydrate()

    const channel = supabase
      .channel('platform-neon-trail')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'platform_settings',
          filter: `key=eq.${NEON_TRAIL_SETTINGS_KEY}`,
        },
        (payload) => {
          const raw = payload.new?.value
          if (!raw) return
          const next = normalizeNeonTrailConfig(raw)
          const current = normalizeNeonTrailConfig(latestConfigRef.current)
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
      return normalizeNeonTrailConfig(next)
    })
  }, [])

  const setEnabled = useCallback((enabled) => {
    setConfigState((prev) => ({ ...prev, enabled: Boolean(enabled) }))
  }, [])

  const updatePanel = useCallback((panelKey, patch) => {
    setConfigState((prev) =>
      normalizeNeonTrailConfig({
        ...prev,
        panels: {
          ...prev.panels,
          [panelKey]: { ...prev.panels[panelKey], ...patch },
        },
      }),
    )
  }, [])

  const updatePanelColor = useCallback((panelKey, index, hex) => {
    setConfigState((prev) => {
      const colors = [...prev.panels[panelKey].colors]
      colors[index] = hex
      return normalizeNeonTrailConfig({
        ...prev,
        panels: {
          ...prev.panels,
          [panelKey]: { ...prev.panels[panelKey], colors },
        },
      })
    })
  }, [])

  const resetDefaults = useCallback(() => {
    setConfigState(structuredClone(DEFAULT_NEON_TRAIL_CONFIG))
  }, [])

  const persistNow = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    return flushRemoteSave(normalizeNeonTrailConfig(latestConfigRef.current))
  }, [flushRemoteSave])

  const value = useMemo(
    () => ({
      config,
      setConfig,
      setEnabled,
      updatePanel,
      updatePanelColor,
      resetDefaults,
      syncStatus,
      syncError,
      persistNow,
    }),
    [
      config,
      setConfig,
      setEnabled,
      updatePanel,
      updatePanelColor,
      resetDefaults,
      syncStatus,
      syncError,
      persistNow,
    ],
  )

  return <NeonTrailContext.Provider value={value}>{children}</NeonTrailContext.Provider>
}

export function useNeonTrail() {
  const ctx = useContext(NeonTrailContext)
  if (!ctx) throw new Error('useNeonTrail must be used within NeonTrailProvider')
  return ctx
}
