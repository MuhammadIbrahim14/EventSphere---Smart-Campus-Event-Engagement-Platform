import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useMascotLibrary } from '@/context/MascotLibraryContext'
import {
  loadStudentMascotLocal,
  normalizeStudentMascot,
  resolveStudentHeroMascot,
  saveStudentMascotLocal,
} from '@/lib/studentMascot'
import { getMyStudentMascotPref, saveMyStudentMascotPref } from '@/services/mascots'
import { isSupabaseConfigured } from '@/lib/supabase'

/** Per-user dashboard mascot — Supabase profile + local cache fallback. */
export function useStudentMascot() {
  const { user } = useAuth()
  const { enabledLibrary, settings } = useMascotLibrary()
  const userId = user?.id ?? null
  const [pref, setPref] = useState(() => loadStudentMascotLocal(userId, enabledLibrary))
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    let alive = true

    async function load() {
      if (!userId) {
        setPref(normalizeStudentMascot(null, enabledLibrary))
        return
      }

      const local = loadStudentMascotLocal(userId, enabledLibrary)
      setPref(local)

      if (!isSupabaseConfigured) return

      setSyncing(true)
      const { data, error } = await getMyStudentMascotPref()
      if (!alive) return

      if (!error && data) {
        const merged = normalizeStudentMascot(data, enabledLibrary)
        setPref(merged)
        saveStudentMascotLocal(userId, merged, enabledLibrary)
      }
      setSyncing(false)
    }

    load()
    return () => {
      alive = false
    }
  }, [userId, enabledLibrary])

  const persist = useCallback(
    async (next) => {
      if (!userId) return
      saveStudentMascotLocal(userId, next, enabledLibrary)
      if (isSupabaseConfigured) {
        await saveMyStudentMascotPref(next)
      }
    },
    [userId, enabledLibrary],
  )

  const update = useCallback(
    (patch) => {
      if (!userId) return
      setPref((prev) => {
        const next = normalizeStudentMascot({ ...prev, ...patch }, enabledLibrary)
        persist(next)
        return next
      })
    },
    [userId, enabledLibrary, persist],
  )

  const pickLibrary = useCallback(
    (mascotId) => {
      update({ source: 'library', mascotId, customUrl: null })
    },
    [update],
  )

  const pickCustom = useCallback(
    (customUrl) => {
      update({ source: 'custom', mascotId: 'custom', customUrl })
    },
    [update],
  )

  const heroMascot = useMemo(
    () => resolveStudentHeroMascot(pref, enabledLibrary),
    [pref, enabledLibrary],
  )

  return {
    pref,
    heroMascot,
    update,
    pickLibrary,
    pickCustom,
    userId,
    ready: Boolean(userId),
    syncing,
    settings,
    library: enabledLibrary,
  }
}
