import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Printer, RefreshCw, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { formatEventSchedule } from '@/lib/eventDate'
import { buildStationCheckinUrl } from '@/lib/stationCheckin'
import { ensureEventCheckinToken } from '@/services/events'

/**
 * Organizer/admin: generate station QR + print/save as PDF poster.
 */
export default function StationCheckinPoster({ event, open, onClose, setToast }) {
  const [meta, setMeta] = useState(null)
  const [busy, setBusy] = useState(false)
  const printRef = useRef(null)

  const load = useCallback(
    async (rotate = false) => {
      if (!event?.id) return
      setBusy(true)
      const { data, error } = await ensureEventCheckinToken(event.id, { rotate })
      setBusy(false)
      if (error) {
        setToast?.(error.message)
        return
      }
      setMeta(data)
      if (rotate) setToast?.('New station code generated — reprint the poster')
    },
    [event?.id, setToast],
  )

  useEffect(() => {
    if (open) load(false)
  }, [open, load])

  if (!open || typeof document === 'undefined') return null

  const token = meta?.checkin_token || ''
  const url = buildStationCheckinUrl(event.id, token)
  const title = meta?.title || event.title || 'Event'
  const venue = meta?.venue || event.venue || ''
  const when = formatEventSchedule({
    date: meta?.event_date || event.date,
    time: meta?.event_time || event.time,
    endTime: meta?.event_end_time || event.endTime,
  })

  const onPrint = () => {
    window.print()
  }

  const onCopyUrl = async () => {
    if (!url) return
    try {
      await navigator.clipboard?.writeText(url)
      setToast?.('Check-in link copied')
    } catch {
      setToast?.('Copy failed — select the link manually')
    }
  }

  return createPortal(
    <div
      className="modal-backdrop es-station-poster-root"
      role="presentation"
      data-es-no-reveal
      style={{ zIndex: 10060 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        style={{ width: 'min(640px, 100%)', pointerEvents: 'auto' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Station QR poster</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0, lineHeight: 1.45 }}>
          Print or Save as PDF, then post at the venue. Scan opens:{' '}
          <code style={{ fontSize: 11 }}>https://eventsphere-sceep.netlify.app/checkin/…</code>
        </p>

        <div ref={printRef} className="es-station-poster" data-testid="station-checkin-poster">
          <div className="es-station-poster__brand">EventSphere · Check-in</div>
          <h3 className="es-station-poster__title">{title}</h3>
          <p className="es-station-poster__when">
            {when}
            {venue ? ` · ${venue}` : ''}
          </p>
          <div className="es-station-poster__qr">
            {url ? (
              <QRCodeSVG value={url} size={220} level="M" includeMargin />
            ) : (
              <p className="muted">Generating code…</p>
            )}
          </div>
          <p className="es-station-poster__cta">Scan to mark your attendance</p>
          <p className="es-station-poster__hint">Must be registered · Sign in on your phone</p>
        </div>

        <p className="muted" style={{ fontSize: 11, wordBreak: 'break-all', marginTop: 10 }}>
          {url || '—'}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <button type="button" className="btn btn-primary" disabled={busy || !url} onClick={onPrint} data-testid="button-print-station-qr">
            <Printer size={14} /> Print / Save PDF
          </button>
          <button type="button" className="btn" disabled={!url} onClick={onCopyUrl}>
            <Download size={14} /> Copy link
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            disabled={busy}
            onClick={() => load(true)}
            data-testid="button-rotate-station-qr"
          >
            <RefreshCw size={14} /> New code
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
