/**
 * Printable digital ID / attendee badge (Phase 5).
 */
import { useRef } from 'react'
import { Download, IdCard } from 'lucide-react'

export default function AttendeeBadgeCard({
  name = 'Attendee',
  eventTitle = 'Campus event',
  roleLabel = 'Attendee',
  eventDate = '',
  venue = '',
  qrDataUrl = '',
  setToast,
}) {
  const ref = useRef(null)

  const printBadge = () => {
    const node = ref.current
    if (!node) return
    const w = window.open('', '_blank', 'noopener,noreferrer,width=480,height=720')
    if (!w) {
      setToast?.('Allow popups to print badge')
      return
    }
    w.document.write(`<!doctype html><html><head><title>Badge</title>
      <style>
        body{font-family:Inter,system-ui,sans-serif;background:#0b0a14;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}
        .badge{width:340px;border-radius:24px;border:1px solid rgba(92,225,255,.35);padding:24px;background:linear-gradient(165deg,#12101c,#0a1218);box-shadow:0 20px 50px rgba(0,0,0,.4)}
        .eyebrow{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#5ce1ff}
        h1{font-size:28px;margin:8px 0 4px;letter-spacing:-.03em}
        .role{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:999px;background:rgba(255,79,216,.2);color:#ff4fd8;font-size:11px;font-weight:700}
        .meta{font-size:12px;color:#aab0c8;margin-top:14px;line-height:1.5}
        img{width:140px;height:140px;object-fit:contain;margin-top:18px;background:#fff;border-radius:12px;padding:8px}
      </style></head><body>${node.outerHTML}<script>window.print()</script></body></html>`)
    w.document.close()
    setToast?.('Badge ready to print / save as PDF')
  }

  return (
    <div className="surface" style={{ padding: 18 }} data-testid="attendee-badge">
      <div className="eyebrow">Digital ID</div>
      <h3 className="display" style={{ margin: '8px 0 12px', fontSize: 18 }}>
        <IdCard size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
        Event badge
      </h3>
      <div ref={ref} className="badge es-id-badge">
        <div className="eyebrow">EventSphere pass</div>
        <h1>{name}</h1>
        <span className="role">{roleLabel}</span>
        <div className="meta">
          <div><strong>{eventTitle}</strong></div>
          <div>{eventDate}</div>
          <div>{venue}</div>
        </div>
        {qrDataUrl ? <img src={qrDataUrl} alt="QR pass" /> : null}
      </div>
      <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={printBadge}>
        <Download size={14} /> Print / PDF badge
      </button>
    </div>
  )
}
