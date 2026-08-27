import { useEffect, useState } from 'react'
import { eventEndDate, eventStartDate, getEventPhase } from '@/lib/eventDate'

function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0')
}

function splitMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return { h, m, s, total }
}

export function formatDurationParts({ h, m, s }) {
  if (h > 0) return `${h} Hour${h === 1 ? '' : 's'} ${m} Minute${m === 1 ? '' : 's'}`
  if (m > 0) return `${m} Minute${m === 1 ? '' : 's'} ${s}s`
  return `${s}s`
}

export default function LiveCountdown({
  event,
  mode = 'auto',
  className = '',
  showBanner = true,
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (!event) return null
  const phase = getEventPhase(event, new Date(now))
  const start = eventStartDate(event)
  const end = eventEndDate(event)
  if (!start || !end) return null

  let label = ''
  let value = ''
  let tone = 'soon'

  if (mode === 'ends' || (mode === 'auto' && phase === 'live')) {
    const left = splitMs(end.getTime() - now)
    label = 'Event Ends In'
    value = formatDurationParts(left)
    tone = 'live'
  } else if (mode === 'elapsed' || (mode === 'auto' && phase === 'live' && false)) {
  } else if (phase === 'starting_soon' || phase === 'upcoming') {
    const left = splitMs(start.getTime() - now)
    label = 'Starts In'
    value = formatDurationParts(left)
    tone = 'soon'
  } else if (phase === 'ended') {
    label = 'Event'
    value = 'Ended'
    tone = 'ended'
  } else if (phase === 'live') {
    const left = splitMs(end.getTime() - now)
    const elapsed = splitMs(now - start.getTime())
    label = 'Event Ends In'
    value = formatDurationParts(left)
    tone = 'live'
    return (
      <div className={`es-live-countdown es-live-countdown--${tone} ${className}`.trim()} data-testid="live-countdown">
        {showBanner ? (
          <div className="es-live-countdown__banner">LIVE EVENT — Event is Running</div>
        ) : null}
        <div className="es-live-countdown__row">
          <span className="es-live-countdown__label">{label}</span>
          <strong className="es-live-countdown__value">{value}</strong>
        </div>
        <div className="es-live-countdown__elapsed">
          Running for {formatDurationParts(elapsed)} · {pad(elapsed.h)}:{pad(elapsed.m)}:{pad(elapsed.s)}
        </div>
      </div>
    )
  } else {
    return null
  }

  return (
    <div className={`es-live-countdown es-live-countdown--${tone} ${className}`.trim()} data-testid="live-countdown">
      {showBanner && phase === 'live' ? (
        <div className="es-live-countdown__banner">LIVE EVENT — Event is Running</div>
      ) : null}
      <div className="es-live-countdown__row">
        <span className="es-live-countdown__label">{label}</span>
        <strong className="es-live-countdown__value">{value}</strong>
      </div>
    </div>
  )
}
