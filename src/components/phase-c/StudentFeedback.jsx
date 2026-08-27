import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getMyAttendance } from '@/services/attendance'
import { submitFeedback } from '@/services/feedback'
import { listMyFeedback } from '@/services/feedback'
import { isEventDayOrPast } from '@/lib/eventDate'

function StarRating({ label, value, onChange, testId }) {
  const n = Number(value) || 0
  return (
    <div className="es-feedback-stars" data-testid={testId}>
      <div className="es-feedback-stars__label">
        <span className="label" style={{ margin: 0 }}>{label}</span>
        <span className="es-feedback-stars__value">{n}/5</span>
      </div>
      <div className="es-feedback-stars__row" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => {
          const on = star <= n
          return (
            <button
              key={star}
              type="button"
              className={`es-feedback-stars__btn ${on ? 'is-on' : ''}`}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              aria-checked={n === star}
              role="radio"
              onClick={() => onChange(star)}
            >
              <Star size={22} fill={on ? 'currentColor' : 'none'} strokeWidth={on ? 0 : 1.75} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function StudentFeedback({ events, setToast }) {
  const { user, profile } = useAuth()
  const [attended, setAttended] = useState([])
  const [done, setDone] = useState(new Set())
  const [form, setForm] = useState({
    eventId: '',
    rating: 5,
    venueRating: 5,
    coordinationRating: 5,
    comments: '',
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const [a, f] = await Promise.all([getMyAttendance(user.id), listMyFeedback(user.id)])
      const present = (a.data || []).filter((x) => x.attended).map((x) => x.event_id)
      setAttended(present)
      setDone(new Set((f.data || []).map((x) => x.event_id)))
      const eligible = (events || []).filter(
        (e) => present.includes(e.id) && isEventDayOrPast(e.date),
      )
      if (eligible[0]) setForm((prev) => ({ ...prev, eventId: eligible[0].id }))
      else if (present[0]) setForm((prev) => ({ ...prev, eventId: present[0] }))
    })()
  }, [user?.id, events])

  const options = (events || []).filter(
    (e) => attended.includes(e.id) && isEventDayOrPast(e.date),
  )
  const selected = options.find((e) => e.id === form.eventId)
  const alreadyDone = form.eventId && done.has(form.eventId)

  async function save() {
    if (!form.eventId) {
      setToast?.('Pick an attended event (on/after event day)')
      return
    }
    const ev = (events || []).find((e) => e.id === form.eventId)
    if (!isEventDayOrPast(ev?.date)) {
      setToast?.('Feedback opens on the event date')
      return
    }
    setBusy(true)
    const { error } = await submitFeedback({
      eventId: form.eventId,
      studentId: user.id,
      rating: Number(form.rating),
      venueRating: Number(form.venueRating),
      coordinationRating: Number(form.coordinationRating),
      comments: form.comments,
    })
    setBusy(false)
    if (error) setToast?.(error.message)
    else {
      setToast?.('Feedback submitted')
      setDone(new Set([...done, form.eventId]))
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">After the event</div>
          <h1>Feedback</h1>
          <p>Rate attended events with stars — available once attendance is marked on/after event day.</p>
        </div>
      </div>

      {!options.length ? (
        <div className="surface" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>
            No attended events yet. Get scanned at the door, then return here.
          </p>
        </div>
      ) : (
        <div className="es-feedback-layout">
          <div className="surface es-feedback-panel">
            <div className="eyebrow">Leave a review</div>
            <h2 className="display" style={{ margin: '10px 0 6px', fontSize: 22 }}>
              How was it, {profile?.full_name?.split(/\s+/)[0] || 'student'}?
            </h2>
            <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
              Your ratings help organizers improve the next campus gathering.
            </p>

            <label className="label">Event</label>
            <select
              className="input"
              value={form.eventId}
              onChange={(e) => setForm({ ...form, eventId: e.target.value })}
              data-testid="select-feedback-event"
            >
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                  {done.has(e.id) ? ' (submitted)' : ''}
                </option>
              ))}
            </select>

            {selected ? (
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                {selected.date} · {selected.venue || 'Campus venue'}
                {alreadyDone ? ' · You already submitted — submit again to update.' : ''}
              </p>
            ) : null}

            <div className="es-feedback-ratings">
              <StarRating
                label="Overall"
                value={form.rating}
                onChange={(rating) => setForm({ ...form, rating })}
                testId="stars-overall"
              />
              <StarRating
                label="Venue"
                value={form.venueRating}
                onChange={(venueRating) => setForm({ ...form, venueRating })}
                testId="stars-venue"
              />
              <StarRating
                label="Coordination"
                value={form.coordinationRating}
                onChange={(coordinationRating) => setForm({ ...form, coordinationRating })}
                testId="stars-coordination"
              />
            </div>

            <label className="label" style={{ marginTop: 8 }}>Comments</label>
            <textarea
              className="input"
              rows={4}
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
              placeholder="What worked? What should change next time?"
              data-testid="input-feedback-comments"
            />

            <button
              className="btn btn-primary"
              style={{ marginTop: 18, width: '100%' }}
              type="button"
              disabled={busy}
              onClick={save}
              data-testid="button-submit-feedback"
            >
              {busy ? 'Saving…' : alreadyDone ? 'Update feedback' : 'Submit feedback'}
            </button>
          </div>

          <div className="surface es-feedback-side">
            <div className="eyebrow">Submitted</div>
            <h3 style={{ margin: '8px 0 12px', fontSize: 16 }}>Your reviews</h3>
            {options.filter((e) => done.has(e.id)).length ? (
              <ul className="es-feedback-done-list">
                {options
                  .filter((e) => done.has(e.id))
                  .map((e) => (
                    <li key={e.id}>
                      <strong>{e.title}</strong>
                      <span className="muted">{e.date}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                No reviews yet — pick an event and tap the stars.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
