import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { useReducedMotion } from 'framer-motion'
import { useFutureImprovements } from '@/context/FutureImprovementsContext'
import { useLogoHoldUnlock } from '@/hooks/useLogoHoldUnlock'

const LOGO_CYCLE_MS = 10000

/**
 * EventSphere brand mark — ultimatum burst on load + every 10s.
 */
export function EsBrandMark({ cycle = 0, className = '' }) {
  return (
    <span
      className={`es-brand-mark brand-mark ${className}`.trim()}
      key={`mark-${cycle}`}
      aria-hidden="true"
    >
      <span className="es-brand-mark__flare" />
      <span className="es-brand-mark__halo" />
      <span className="es-brand-mark__ring es-brand-mark__ring--a" />
      <span className="es-brand-mark__ring es-brand-mark__ring--b" />
      <span className="es-brand-mark__ring es-brand-mark__ring--c" />
      <span className="es-brand-mark__core" />
      <span className="es-brand-mark__spark" />
    </span>
  )
}

/**
 * Full sidebar / shell brand link with animated mark + name.
 */
export default function EsBrandLogo({
  href = '/',
  name = 'EVENTSPHERE',
  caption = 'Command center',
  className = '',
  testId = 'link-brand',
  holdUnlock = true,
}) {
  const reduce = useReducedMotion()
  const [cycle, setCycle] = useState(0)
  const { openPanel } = useFutureImprovements()
  const { holding, progress, holdHandlers } = useLogoHoldUnlock(
    holdUnlock ? openPanel : undefined,
  )

  useEffect(() => {
    if (reduce) return undefined
    const id = window.setInterval(() => {
      setCycle((n) => n + 1)
    }, LOGO_CYCLE_MS)
    return () => window.clearInterval(id)
  }, [reduce])

  const playClass = reduce ? '' : ' es-brand-logo--play'
  const holdClass =
    holdUnlock && !reduce
      ? ` es-brand-logo--holdable${holding ? ' es-brand-logo--holding' : ''}`
      : ''

  return (
    <Link
      href={href}
      className={`brand es-brand-logo${playClass}${holdClass} ${className}`.trim()}
      data-testid={testId}
      data-logo-cycle={cycle}
      aria-label={`${name} home`}
      style={holding ? { '--hold-pct': progress } : undefined}
      {...(holdUnlock && !reduce ? holdHandlers : {})}
    >
      {holdUnlock && !reduce ? (
        <span className="es-brand-hold-ring" aria-hidden="true" />
      ) : null}
      <span className="es-brand-mark-wrap" aria-hidden="true">
        <EsBrandMark cycle={cycle} />
      </span>
      <span className="es-brand-logo__copy">
        <span className="brand-name es-brand-logo__name" key={`name-${cycle}`}>
          <span className="es-brand-logo__name-row">Event</span>
          <span className="es-brand-logo__name-row es-brand-logo__name-row--accent">Sphere</span>
        </span>
        <span className="brand-caption es-brand-logo__caption" key={`cap-${cycle}`}>
          {caption}
        </span>
      </span>
    </Link>
  )
}
