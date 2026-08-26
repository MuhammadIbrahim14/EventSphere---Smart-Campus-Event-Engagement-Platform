import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from 'framer-motion'
import { EsBrandMark } from '@/components/design-system/EsBrandLogo'

const SPLASH_KEY = 'es_splash_v1'
const SPLASH_MS = 2800

export function hasSeenSplash() {
  if (typeof window === 'undefined') return true
  try {
    return sessionStorage.getItem(SPLASH_KEY) === '1'
  } catch {
    return false
  }
}

export function markSplashSeen() {
  try {
    sessionStorage.setItem(SPLASH_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearSplashSeen() {
  try {
    sessionStorage.removeItem(SPLASH_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * One-shot branded splash for guest entry (once per browser tab session).
 * Portaled to document.body so it always covers the viewport above app chrome.
 */
export default function EsSplash({ onDone, force = false }) {
  const reduce = useReducedMotion()
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const [visible, setVisible] = useState(() => {
    if (force) return true
    return !hasSeenSplash()
  })
  const [exiting, setExiting] = useState(false)
  const finishedRef = useRef(false)

  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    markSplashSeen()
    setVisible(false)
    onDoneRef.current?.()
  }

  useEffect(() => {
    if (!visible) {
      if (!finishedRef.current) {
        finishedRef.current = true
        onDoneRef.current?.()
      }
      return undefined
    }

    const duration = reduce ? 500 : SPLASH_MS
    const exitAt = Math.max(120, duration - 380)
    const exitTimer = window.setTimeout(() => setExiting(true), exitAt)
    const doneTimer = window.setTimeout(finish, duration)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(doneTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once while visible; finish via ref
  }, [visible, reduce])

  useEffect(() => {
    if (!visible) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [visible])

  if (!visible || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`es-splash ${exiting ? 'es-splash--out' : ''} ${reduce ? 'es-splash--reduce' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="EventSphere welcome"
      data-testid="es-splash"
    >
      <div className="es-splash__veil" aria-hidden />
      <div className="es-splash__orbit" aria-hidden />
      <div className="es-splash__core">
        <EsBrandMark cycle={0} />
        <p className="es-splash__brand">EventSphere</p>
        <p className="es-splash__tag">Campus events, in orbit</p>
      </div>
      <button type="button" className="es-splash__skip" onClick={finish} data-testid="button-skip-splash">
        Skip
      </button>
    </div>,
    document.body,
  )
}
