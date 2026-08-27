/**
 * Printable digital ID / attendee badge (Phase 5).
 * Prints via a hidden iframe (no blank popup tab).
 */
import { useRef } from 'react'
import { Download, IdCard } from 'lucide-react'

function buildBadgeHtml(innerHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>EventSphere badge</title>
<style>
  @page { margin: 12mm; }
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0a14;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box}
  .es-id-badge{width:340px;max-width:100%;border-radius:24px;border:1px solid rgba(92,225,255,.35);padding:24px;background:linear-gradient(165deg,#12101c,#0a1218);box-shadow:0 20px 50px rgba(0,0,0,.4);box-sizing:border-box}
  .es-id-badge .eyebrow{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#5ce1ff;font-weight:700}
  .es-id-badge h1{font-size:28px;margin:8px 0 4px;letter-spacing:-.03em;font-weight:700}
  .es-id-badge .role{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:999px;background:rgba(255,79,216,.2);color:#ff4fd8;font-size:11px;font-weight:700}
  .es-id-badge .meta{font-size:12px;color:#aab0c8;margin-top:14px;line-height:1.5}
  .es-id-badge img{width:140px;height:140px;object-fit:contain;margin-top:18px;background:#fff;border-radius:12px;padding:8px}
</style></head><body>${innerHtml}</body></html>`
}

function printHtmlDocument(html) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    return false
  }

  doc.open()
  doc.write(html)
  doc.close()

  const runPrint = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      window.setTimeout(() => iframe.remove(), 1500)
    }
  }

  // Some browsers need a tick after write before print layout is ready
  if (iframe.contentWindow?.document?.readyState === 'complete') {
    window.setTimeout(runPrint, 50)
  } else {
    iframe.onload = () => window.setTimeout(runPrint, 50)
    window.setTimeout(runPrint, 300)
  }
  return true
}

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
    const ok = printHtmlDocument(buildBadgeHtml(node.outerHTML))
    if (!ok) {
      setToast?.('Could not open print dialog — try again')
      return
    }
    setToast?.('Print dialog opened — choose Save as PDF if needed')
  }

  return (
    <div className="surface" style={{ padding: 18 }} data-testid="attendee-badge">
      <div className="eyebrow">Digital ID</div>
      <h3 className="display" style={{ margin: '8px 0 12px', fontSize: 18 }}>
        <IdCard size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
        Event badge
      </h3>
      <div ref={ref} className="es-id-badge">
        <div className="eyebrow">EventSphere pass</div>
        <h1>{name}</h1>
        <span className="role">{roleLabel}</span>
        <div className="meta">
          <div>
            <strong>{eventTitle}</strong>
          </div>
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
