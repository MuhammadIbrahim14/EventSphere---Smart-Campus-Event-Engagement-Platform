import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from 'framer-motion'
import { EsBrandMark } from '@/components/design-system/EsBrandLogo'

const PHASE_COPY = {
  session: {
    title: 'Loading session',
    subtitle: 'Restoring your orbit credentials',
  },
  campus: {
    title: 'Loading campus data',
    subtitle: 'Syncing events, registrations & venues',
  },
  guest: {
    title: 'Loading guest hub',
    subtitle: 'Syncing your passes & registrations',
  },
  auth: {
    title: 'Opening orbital gate',
    subtitle: 'Preparing secure campus sign-in',
  },
  redirect: {
    title: 'Redirecting',
    subtitle: 'Plotting your course through the sphere',
  },
}

/**
 * Full-viewport boot loader — centered orbital chrome for reload / data sync.
 * Portaled to document.body so it always covers the viewport.
 */
export default function CampusBootLoader({
  phase = 'campus',
  title,
  subtitle,
  testId = 'campus-boot-loader',
}) {
  const reduce = useReducedMotion()
  const copy = PHASE_COPY[phase] || PHASE_COPY.campus

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`es-boot ${reduce ? 'es-boot--reduce' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title || copy.title}
      data-testid={testId}
      data-phase={phase}
    >
      <div className="es-boot__veil" aria-hidden />
      <div className="es-boot__grid" aria-hidden />

      <div className="es-boot__stage">
        <div className="es-boot__orbit" aria-hidden>
          <div className="es-boot__signal">
            <span className="es-boot__signal-beam" />
            <span className="es-boot__signal-ping es-boot__signal-ping--a" />
            <span className="es-boot__signal-ping es-boot__signal-ping--b" />
          </div>
          <span className="es-boot__ring es-boot__ring--a" />
          <span className="es-boot__ring es-boot__ring--b" />
          <span className="es-boot__ring es-boot__ring--c" />
        </div>

        <div className="es-boot__core">
          <div className="es-boot__mark-wrap">
            <EsBrandMark cycle={0} className="es-boot__mark" />
          </div>

          <p className="es-boot__brand">EventSphere</p>
          <h2 className="es-boot__title">{title || copy.title}</h2>
          <p className="es-boot__subtitle">{subtitle || copy.subtitle}</p>

          <div className="es-boot__progress" aria-hidden>
            <span className="es-boot__progress-bar" />
          </div>

          <div className="es-boot__dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
