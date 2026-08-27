import { useEffect, useMemo, useState } from 'react'
import { listEventFeedback } from '@/services/feedback'
import { attendeeAudience, isPublicGuestRole } from '@/constants/roles'

/** Phase D3 — peer reviews; split campus students vs public guests. */
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

  const { studentRows, publicRows } = useMemo(() => {
    const student = []
    const pub = []
    for (const r of rows) {
      if (isPublicGuestRole(r.profiles?.role) || attendeeAudience(r.profiles) === 'public') {
        pub.push(r)
      } else {
        student.push(r)
      }
    }
    return { studentRows: student, publicRows: pub }
  }, [rows])

  function renderList(list, emptyCopy) {
    if (!list.length) {
      return (
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {emptyCopy}
        </p>
      )
    }
    return (
      <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
        {list.map((r) => (
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
    )
  }

  return (
    <div className="surface" style={{ padding: 18, marginTop: 16 }} data-testid="event-reviews">
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
          No published reviews yet. Attendees can leave feedback after attendance is marked.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <div className="es-review-split">
          <section className="es-review-split__col">
            <div className="es-review-split__head">
              <h3>Campus students</h3>
              <span className="eyebrow">{studentRows.length}</span>
            </div>
            {renderList(studentRows, 'No student reviews yet.')}
          </section>
          <section className="es-review-split__col">
            <div className="es-review-split__head">
              <h3>Public guests</h3>
              <span className="eyebrow">{publicRows.length}</span>
            </div>
            {renderList(publicRows, 'No public guest reviews yet.')}
          </section>
        </div>
      )}
    </div>
  )
}
