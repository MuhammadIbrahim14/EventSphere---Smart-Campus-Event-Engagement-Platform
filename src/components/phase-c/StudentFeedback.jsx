import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getMyAttendance } from '@/services/attendance'
import { submitFeedback } from '@/services/feedback'
import { listMyFeedback } from '@/services/feedback'
import { isEventDayOrPast } from '@/lib/eventDate'

export default function StudentFeedback({ events, setToast }) {
  const { user } = useAuth()
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
          <p>Available after attendance is marked — on or after the event date.</p>
        </div>
      </div>
      {!options.length ? (
        <div className="surface" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>
            No attended events yet. Get scanned at the door, then return here.
          </p>
        </div>
      ) : (
        <div className="surface" style={{ padding: 22 }}>
          <div className="form-grid">
            <div className="full">
              <label className="label">Event</label>
              <select
                className="input"
                value={form.eventId}
                onChange={(e) => setForm({ ...form, eventId: e.target.value })}
              >
                {options.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                    {done.has(e.id) ? ' (submitted)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Overall (1–5)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={5}
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Venue</label>
              <input
                className="input"
                type="number"
                min={1}
                max={5}
                value={form.venueRating}
                onChange={(e) => setForm({ ...form, venueRating: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Coordination</label>
              <input
                className="input"
                type="number"
                min={1}
                max={5}
                value={form.coordinationRating}
                onChange={(e) => setForm({ ...form, coordinationRating: e.target.value })}
              />
            </div>
            <div className="full">
              <label className="label">Comments</label>
              <textarea
                className="input"
                rows={3}
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
              />
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 18 }} type="button" disabled={busy} onClick={save}>
            Submit feedback
          </button>
        </div>
      )}
    </>
  )
}
