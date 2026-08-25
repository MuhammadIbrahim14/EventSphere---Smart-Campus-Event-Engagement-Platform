import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  fallbackCampusMascots,
  getMascotExperienceSettings,
  listCampusMascots,
} from '@/services/mascots'
import { isSupabaseConfigured } from '@/lib/supabase'

const MascotLibraryContext = createContext(null)

export function MascotLibraryProvider({ children }) {
  const [library, setLibrary] = useState(() => fallbackCampusMascots())
  const [settings, setSettings] = useState({
    student_upload_enabled: true,
    max_upload_mb: 2,
  })
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured))

  const refresh = useCallback(async ({ includeDisabled = false } = {}) => {
    if (!isSupabaseConfigured) {
      setLibrary(fallbackCampusMascots())
      setLoading(false)
      return { library: fallbackCampusMascots(), settings: { student_upload_enabled: true, max_upload_mb: 2 } }
    }

    setLoading(true)
    const [libRes, setRes] = await Promise.all([
      listCampusMascots({ includeDisabled }),
      getMascotExperienceSettings(),
    ])

    const nextLibrary = libRes.data?.length ? libRes.data : fallbackCampusMascots()
    setLibrary(nextLibrary)

    const nextSettings = setRes.data
      ? {
          student_upload_enabled: setRes.data.student_upload_enabled !== false,
          max_upload_mb: setRes.data.max_upload_mb || 2,
        }
      : { student_upload_enabled: true, max_upload_mb: 2 }

    setSettings(nextSettings)
    setLoading(false)
    return { library: nextLibrary, settings: nextSettings }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const enabledLibrary = useMemo(
    () => library.filter((m) => m.enabled !== false),
    [library],
  )

  const value = useMemo(
    () => ({
      library,
      enabledLibrary,
      settings,
      loading,
      refresh,
    }),
    [library, enabledLibrary, settings, loading, refresh],
  )

  return (
    <MascotLibraryContext.Provider value={value}>{children}</MascotLibraryContext.Provider>
  )
}

export function useMascotLibrary() {
  const ctx = useContext(MascotLibraryContext)
  if (!ctx) {
    return {
      library: fallbackCampusMascots(),
      enabledLibrary: fallbackCampusMascots(),
      settings: { student_upload_enabled: true, max_upload_mb: 2 },
      loading: false,
      refresh: async () => ({ library: fallbackCampusMascots() }),
    }
  }
  return ctx
}
