import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_NEON_TRAIL_CONFIG,
  applyNeonTrailConfig,
  loadNeonTrailConfig,
  normalizeNeonTrailConfig,
  saveNeonTrailConfig,
} from '@/lib/neonTrail'

const NeonTrailContext = createContext(null)

export function NeonTrailProvider({ children }) {
  const [config, setConfigState] = useState(() => loadNeonTrailConfig())

  useEffect(() => {
    const next = normalizeNeonTrailConfig(config)
    applyNeonTrailConfig(next)
    saveNeonTrailConfig(next)
  }, [config])

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

  const value = useMemo(
    () => ({
      config,
      setConfig,
      setEnabled,
      updatePanel,
      updatePanelColor,
      resetDefaults,
    }),
    [config, setConfig, setEnabled, updatePanel, updatePanelColor, resetDefaults],
  )

  return <NeonTrailContext.Provider value={value}>{children}</NeonTrailContext.Provider>
}

export function useNeonTrail() {
  const ctx = useContext(NeonTrailContext)
  if (!ctx) throw new Error('useNeonTrail must be used within NeonTrailProvider')
  return ctx
}
