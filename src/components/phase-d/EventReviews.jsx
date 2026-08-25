import { useEffect, useState } from 'react'
import { listEventFeedback } from '@/services/feedback'

/** Phase D3 — peer reviews on approved event detail (read-only). */
export default function EventReviews({ eventId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!eventId) return
    let alive = true
    ;(async () => {
      setLoading(true)
      const { data, error: err } = await listEventFeedback(eventId)
      if (!alive) return
      if (err) setError(err.message)
      else setRows(data || [])
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [eventId])

  return (
    <div className="surface" style={{ padding: 18, marginTop: 16 }}>
      <div className="section-title">
        <h2 style={{ fontSize: 16, margin: 0 }}>Peer reviews</h2>
        <span className="muted" style={{ fontSize: 11 }}>
          After attendance
        </span>
      </div>
      {loading && <p className="muted" style={{ fontSize: 12 }}>Loading reviews…</p>}
      {error && (
        <p className="muted" style={{ fontSize: 12, color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      {!loading && !rows.length && (
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          No published reviews yet. Students can leave feedback after attendance is marked.
        </p>
      )}
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {rows.map((r) => (
          <div key={r.id} className="surface-soft" style={{ padding: 14 }}>
            <div className="section-title" style={{ marginBottom: 6 }}>
              <strong style={{ fontSize: 13 }}>{r.profiles?.full_name || 'Attendee'}</strong>
              <span className="mono muted" style={{ fontSize: 11 }}>
                ★ {r.rating}/5
              </span>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '0 0 8px', lineHeight: 1.5 }}>
              {r.comments || 'No written comments.'}
            </p>
            <div className="chips">
              {r.venue_rating != null && (
                <span className="chip" style={{ pointerEvents: 'none' }}>
                  Venue {r.venue_rating}
                </span>
              )}
              {r.coordination_rating != null && (
                <span className="chip" style={{ pointerEvents: 'none' }}>
                  Coordination {r.coordination_rating}
                </span>
              )}
              {r.technical_rating != null && (
                <span className="chip" style={{ pointerEvents: 'none' }}>
                  Technical {r.technical_rating}
                </span>
              )}
              {r.hospitality_rating != null && (
                <span className="chip" style={{ pointerEvents: 'none' }}>
                  Hospitality {r.hospitality_rating}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
