import { useCallback, useEffect, useState } from 'react'
import { Copy, Sparkles, Ticket } from 'lucide-react'
import { TABLES } from '@/constants/domain'
import { useRealtimeTables } from '@/hooks/useRealtimeTables'
import { listPublicPromoCampaigns } from '@/services/growth'
import {
  campaignTitle,
  copyPromoToClipboard,
  formatPromoValue,
  isSponsorshipPromo,
  remainingSeatsLabel,
} from '@/lib/promoCampaign'

/**
 * Public / sponsorship deal strip — Discover / event detail.
 * Event detail only shows deals for that event; Discover lists event-linked deals with names.
 */
export default function PromoCampaignBanner({
  placement = 'discover',
  eventId = null,
  events = [],
  setToast,
  go,
  compact = false,
}) {
  const [rows, setRows] = useState([])

  const load = useCallback(async () => {
    const { data, error } = await listPublicPromoCampaigns({ eventId, placement })
    if (error) {
      if (/is_public|campaign_headline|campaign_kind|event_id|column/i.test(error.message || '')) {
        setRows([])
        return
      }
      setToast?.(error.message)
      setRows([])
      return
    }
    setRows(data || [])
  }, [eventId, placement, setToast])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeTables([TABLES.PROMO_CODES], load, {
    channelName: `es-promo-campaign-${placement}-${eventId || 'all'}`,
    debounceMs: 600,
  })

  if (!rows.length) return null

  const onCopy = async (promo) => {
    const { ok, code } = await copyPromoToClipboard(promo.code)
    if (!ok) return
    setToast?.(
      isSponsorshipPromo(promo)
        ? `Copied ${code} — paste it on checkout and tap Apply`
        : `Copied ${code} — paste at paid checkout and tap Apply`,
    )
  }

  const onUse = async (promo) => {
    await onCopy(promo)
    if (promo.event_id && typeof go === 'function') {
      go(`/student/event/${promo.event_id}`)
    }
  }

  const eventTitle = (promo) => {
    if (promo.event_title) return promo.event_title
    const id = promo.event_id
    if (!id) return null
    const ev = (events || []).find((e) => String(e.id) === String(id))
    return ev?.title || 'Linked event'
  }

  const headLabel = rows.some(isSponsorshipPromo)
    ? 'Sponsorship discounts'
    : 'Campus deals'

  return (
    <section
      className={`es-promo-rail ${compact ? 'es-promo-rail--compact' : ''}`}
      data-testid="promo-campaign-banner"
      aria-label={headLabel}
    >
      <div className="es-promo-rail__head">
        <Sparkles size={15} />
        <div>
          <div className="eyebrow" style={{ margin: 0 }}>
            {placement === 'event_detail' ? 'This event' : 'Limited offers'}
          </div>
          <strong style={{ fontSize: 14 }}>{headLabel}</strong>
        </div>
      </div>
      <div className="es-promo-rail__list">
        {rows.map((p) => {
          const sponsored = isSponsorshipPromo(p)
          const seats = remainingSeatsLabel(p)
          const title = eventTitle(p)
          return (
            <article
              key={p.id}
              className={`es-promo-card ${sponsored ? 'es-promo-card--sponsor' : ''}`}
              data-testid={`promo-card-${p.code}`}
            >
              <div className="es-promo-card__badge">
                <Ticket size={13} /> {formatPromoValue(p)}
                {sponsored ? <span className="es-promo-card__tag">Sponsored</span> : null}
              </div>
              <h3 className="es-promo-card__title">{campaignTitle(p)}</h3>
              {p.campaign_blurb ? (
                <p className="muted" style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.45 }}>
                  {p.campaign_blurb}
                </p>
              ) : sponsored ? (
                <p className="muted" style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.45 }}>
                  Sponsorship discount for a limited number of students on this event.
                </p>
              ) : null}
              <p className="es-promo-card__code">
                Code <strong>{p.code}</strong>
                {title ? (
                  <span className="muted"> · {title}</span>
                ) : (
                  <span className="muted"> · All paid events</span>
                )}
              </p>
              {seats ? (
                <p className="es-promo-card__seats" data-testid={`promo-seats-${p.code}`}>
                  {seats}
                </p>
              ) : null}
              <div className="es-promo-card__actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onCopy(p)}
                  data-testid={`button-copy-promo-${p.code}`}
                >
                  <Copy size={14} /> Copy code
                </button>
                {placement === 'discover' && p.event_id && go ? (
                  <button type="button" className="btn" onClick={() => onUse(p)}>
                    Open event
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
