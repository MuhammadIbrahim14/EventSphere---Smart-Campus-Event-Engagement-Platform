import { useEffect, useRef, useState } from 'react'
import {
  BOOT_MIN_MS,
  BOOT_MIN_REDUCE_MS,
  getBootLoaderContext,
  isDocumentReload,
  resolveBootPhase,
} from '@/lib/campusBootGate'

export function useCampusBootGate({ path, authLoading, role, dataLoading }) {
  const bootContext = getBootLoaderContext(path)
  const mountAt = useRef(typeof performance !== 'undefined' ? performance.now() : 0)
  const reloadBoot = useRef(isDocumentReload())

  const sessionPending = Boolean(authLoading)
  const campusDataPending = Boolean(role && dataLoading) && bootContext !== 'auth'

  const [minHold, setMinHold] = useState(() => Boolean(bootContext && reloadBoot.current))

  useEffect(() => {
    if (!bootContext || !reloadBoot.current) {
      setMinHold(false)
      return undefined
    }

    if (sessionPending || campusDataPending) return undefined

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const minMs = reduced ? BOOT_MIN_REDUCE_MS : BOOT_MIN_MS
    const elapsed = performance.now() - mountAt.current
    const remaining = Math.max(0, minMs - elapsed)

    if (remaining === 0) {
      setMinHold(false)
      return undefined
    }

    const timer = window.setTimeout(() => setMinHold(false), remaining)
    return () => window.clearTimeout(timer)
  }, [bootContext, sessionPending, campusDataPending, path])

  const booting = Boolean(bootContext) && (sessionPending || campusDataPending || minHold)
  const phase = resolveBootPhase(bootContext, sessionPending, campusDataPending)

  return { booting, phase, bootContext }
}
