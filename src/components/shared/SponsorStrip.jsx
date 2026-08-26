/**
 * Sponsor logo strip (Phase 4).
 * - Discover / global: campus-wide sponsors only (no event_id)
 * - Event detail: pass eventId → only that event’s sponsors
 */
import { useEffect, useState } from 'react'
import { listSponsors } from '@/services/growth'

export default function SponsorStrip({
  placement = 'all',
  eventId = null,
  title = 'Sponsored by campus partners',
}) {
  const [rows, setRows] = useState([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await listSponsors({ placement, eventId })
      if (alive) setRows(data || [])
    })()
    return () => {
      alive = false
    }
  }, [placement, eventId])

  if (!rows.length) return null

  return (
    <section className="es-sponsor-strip" aria-label="Sponsors" data-testid="sponsor-strip">
      <div className="eyebrow">{title}</div>
      <div className="es-sponsor-strip__row">
        {rows.map((s) => {
          const img = (
            <img key={s.id} src={s.logo_url} alt={s.name} title={s.name} loading="lazy" />
          )
          return s.link_url ? (
            <a key={s.id} href={s.link_url} target="_blank" rel="noreferrer noopener">
              {img}
            </a>
          ) : (
            img
          )
        })}
      </div>
    </section>
  )
}
