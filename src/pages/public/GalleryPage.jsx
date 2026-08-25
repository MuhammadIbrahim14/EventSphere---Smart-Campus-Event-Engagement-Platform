import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import PublicShell from './PublicShell'
import { listMedia } from '@/services/media'
import { EVENT_CATEGORIES } from '@/constants/domain'

export default function GalleryPage() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [year, setYear] = useState('All')
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const { data, error: err } = await listMedia()
      if (!alive) return
      if (err) setError(err.message)
      else setRows(data || [])
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  const years = useMemo(() => {
    const set = new Set()
    rows.forEach((r) => {
      const d = r.events?.event_date
      if (d) set.add(String(d).slice(0, 4))
    })
    return ['All', ...Array.from(set).sort().reverse()]
  }, [rows])

  const filtered = rows.filter((r) => {
    const cat = r.events?.category || ''
    const y = String(r.events?.event_date || '').slice(0, 4)
    const okCat = category === 'All' || cat === category
    const okYear = year === 'All' || y === year
    return okCat && okYear
  })

  const active = filtered.find((r) => r.id === activeId) || null
  const activeIndex = filtered.findIndex((r) => r.id === activeId)

  useEffect(() => {
    if (!activeId) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setActiveId(null)
      if (e.key === 'ArrowRight' && activeIndex >= 0 && activeIndex < filtered.length - 1) {
        setActiveId(filtered[activeIndex + 1].id)
      }
      if (e.key === 'ArrowLeft' && activeIndex > 0) {
        setActiveId(filtered[activeIndex - 1].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeId, activeIndex, filtered])

  return (
    <PublicShell eyebrow="Campus moments" title="Media Gallery">
      <div className="surface" style={{ padding: 14, marginBottom: 16 }}>
        <div className="chips" role="group" aria-label="Filter by category">
          {['All', ...EVENT_CATEGORIES.slice(0, 6)].map((c) => (
            <button
              key={c}
              type="button"
              className={`chip ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="chips" style={{ marginTop: 10 }} role="group" aria-label="Filter by year">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              className={`chip ${year === y ? 'active' : ''}`}
              onClick={() => setYear(y)}
              aria-pressed={year === y}
            >
              {y === 'All' ? 'All years' : y}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="muted">Loading gallery…</p>}
      {error && <p className="muted" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}
      {!loading && !filtered.length && (
        <div className="surface" style={{ padding: 28 }}>
          <p className="muted" style={{ margin: 0 }}>
            No public media yet. Organizers can upload after events go live.
          </p>
        </div>
      )}
      <div className="grid-3 stagger" role="list">
        {filtered.map((item) => (
          <article className="surface gallery-tile" style={{ overflow: 'hidden' }} key={item.id} role="listitem">
            <button
              type="button"
              className="gallery-open"
              onClick={() => setActiveId(item.id)}
              aria-label={`Open ${item.caption || item.events?.title || 'media'}`}
            >
              {item.file_type === 'video' ? (
                <video
                  src={item.file_url}
                  muted
                  playsInline
                  style={{ width: '100%', display: 'block', aspectRatio: '16/10', objectFit: 'cover', pointerEvents: 'none' }}
                />
              ) : (
                <img
                  src={item.file_url}
                  alt={item.caption || item.events?.title || 'Event media'}
                  loading="lazy"
                  style={{ width: '100%', display: 'block', aspectRatio: '16/10', objectFit: 'cover' }}
                />
              )}
            </button>
            <div style={{ padding: 14 }}>
              <div className="eyebrow">{item.events?.category || 'Campus'}</div>
              <h3 className="display" style={{ margin: '8px 0 4px', fontSize: 17 }}>
                {item.events?.title || 'Event media'}
              </h3>
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                {item.caption || String(item.events?.event_date || '')}
              </p>
            </div>
          </article>
        ))}
      </div>

      {active && (
        <div
          className="modal-backdrop gallery-lightbox"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setActiveId(null)}
        >
          <div
            className="modal gallery-lightbox-panel"
            role="dialog"
            aria-modal="true"
            aria-label={active.caption || active.events?.title || 'Media'}
          >
            <div className="modal-head">
              <h2 style={{ fontSize: 18, margin: 0 }}>{active.events?.title || 'Event media'}</h2>
              <button className="icon-btn" type="button" onClick={() => setActiveId(null)} aria-label="Close lightbox">
                <X size={18} />
              </button>
            </div>
            {active.file_type === 'video' ? (
              <video src={active.file_url} controls autoPlay style={{ width: '100%', maxHeight: '70vh', background: '#000' }} />
            ) : (
              <img
                src={active.file_url}
                alt={active.caption || active.events?.title || 'Event media'}
                style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', background: '#0a0b12' }}
              />
            )}
            <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>
              {active.caption || 'No caption'} · {active.events?.category || 'Campus'} ·{' '}
              {String(active.events?.event_date || '')}
            </p>
            <p className="subtle" style={{ fontSize: 11, marginTop: 6 }}>
              Esc to close · ← → to browse
            </p>
          </div>
        </div>
      )}
    </PublicShell>
  )
}
