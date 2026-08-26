/**
 * Staff media moderation — list + hide/unhide without changing public gallery rules.
 */
import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, RefreshCw } from 'lucide-react'
import { TABLES } from '@/constants/domain'
import { hideMedia, listMediaForModeration } from '@/services/media'
import { useRealtimeTables } from '@/hooks/useRealtimeTables'

export default function MediaModeration({ eventId = null, setToast, title = 'Media moderation' }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [filter, setFilter] = useState('all') // all | visible | hidden

  const load = useCallback(
    async (opts = {}) => {
      const silent = Boolean(opts.silent)
      if (!silent) setLoading(true)
      const { data, error } = await listMediaForModeration({ eventId: eventId || undefined })
      if (error && !silent) setToast?.(error.message)
      setRows(data || [])
      if (!silent) setLoading(false)
    },
    [eventId, setToast],
  )

  useEffect(() => {
    load()
  }, [load])

  useRealtimeTables([TABLES.MEDIA_GALLERY], () => load({ silent: true }), {
    channelName: `es-media-${eventId || 'all'}`,
  })

  const visible = rows.filter((r) => {
    if (filter === 'visible') return !r.is_hidden
    if (filter === 'hidden') return r.is_hidden
    return true
  })

  const toggle = async (row) => {
    setBusyId(row.id)
    const next = !row.is_hidden
    const { error } = await hideMedia(row.id, next)
    setBusyId(null)
    if (error) {
      setToast?.(error.message)
      return
    }
    setToast?.(next ? 'Media hidden from public gallery' : 'Media restored to public gallery')
    load()
  }

  return (
    <div className="surface" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div className="eyebrow">Gallery · moderation</div>
          <h3 className="display" style={{ margin: '6px 0 0', fontSize: 18 }}>{title}</h3>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div className="chips">
            {[
              ['all', 'All'],
              ['visible', 'Public'],
              ['hidden', 'Hidden'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`chip ${filter === id ? 'active' : ''}`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="btn" type="button" onClick={load} disabled={loading} aria-label="Refresh media">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {loading && <p className="muted" style={{ marginTop: 14 }}>Loading media…</p>}
      {!loading && !visible.length && (
        <p className="muted" style={{ marginTop: 14 }}>No media in this filter.</p>
      )}

      <div className="grid-3" style={{ marginTop: 16 }}>
        {visible.map((item) => (
          <article
            key={item.id}
            className="surface"
            style={{ overflow: 'hidden', border: item.is_hidden ? '1px dashed var(--line)' : undefined }}
          >
            {item.file_type === 'video' ? (
              <video
                src={item.file_url}
                controls
                style={{ width: '100%', display: 'block', aspectRatio: '16/10', objectFit: 'cover' }}
              />
            ) : (
              <img
                src={item.file_url}
                alt={item.caption || item.events?.title || 'Event media'}
                loading="lazy"
                style={{ width: '100%', display: 'block', aspectRatio: '16/10', objectFit: 'cover' }}
              />
            )}
            <div style={{ padding: 12 }}>
              <div className="eyebrow">{item.is_hidden ? 'Hidden' : 'Public'} · {item.events?.category || 'Campus'}</div>
              <strong style={{ display: 'block', marginTop: 6, fontSize: 13 }}>
                {item.events?.title || 'Event media'}
              </strong>
              <p className="muted" style={{ fontSize: 11, margin: '4px 0 10px' }}>
                {item.caption || 'No caption'}
              </p>
              <button
                className="btn"
                type="button"
                disabled={busyId === item.id}
                onClick={() => toggle(item)}
                aria-label={item.is_hidden ? 'Show in public gallery' : 'Hide from public gallery'}
              >
                {item.is_hidden ? <><Eye size={14} /> Unhide</> : <><EyeOff size={14} /> Hide</>}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
