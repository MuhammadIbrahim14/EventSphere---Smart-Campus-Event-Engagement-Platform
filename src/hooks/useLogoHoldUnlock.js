import { useCallback, useRef, useState } from 'react'

const HOLD_MS = 5000

/**
 * Long-press / hold on brand logo → unlock hidden panel (no URL).
 */
export function useLogoHoldUnlock(onUnlock) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const timerRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(0)
  const unlockedRef = useRef(false)

  const clearHold = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    timerRef.current = null
    rafRef.current = null
    startRef.current = 0
    setHolding(false)
    setProgress(0)
  }, [])

  const tick = useCallback(() => {
    const elapsed = Date.now() - startRef.current
    const pct = Math.min(100, (elapsed / HOLD_MS) * 100)
    setProgress(pct)
    if (pct < 100) {
      rafRef.current = window.requestAnimationFrame(tick)
    }
  }, [])

  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return
      unlockedRef.current = false
      startRef.current = Date.now()
      setHolding(true)
      setProgress(0)
      rafRef.current = window.requestAnimationFrame(tick)
      timerRef.current = window.setTimeout(() => {
        unlockedRef.current = true
        clearHold()
        onUnlock?.()
        try {
          navigator.vibrate?.(12)
        } catch {
          /* ignore */
        }
      }, HOLD_MS)
    },
    [clearHold, onUnlock, tick],
  )

  const onPointerUp = useCallback(() => {
    clearHold()
  }, [clearHold])

  const onPointerLeave = useCallback(() => {
    clearHold()
  }, [clearHold])

  const onPointerCancel = useCallback(() => {
    clearHold()
  }, [clearHold])

  const onClickCapture = useCallback((e) => {
    if (unlockedRef.current) {
      e.preventDefault()
      e.stopPropagation()
      unlockedRef.current = false
    }
  }, [])

  return {
    holding,
    progress,
    holdHandlers: {
      onPointerDown,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
      onClickCapture,
    },
  }
}
