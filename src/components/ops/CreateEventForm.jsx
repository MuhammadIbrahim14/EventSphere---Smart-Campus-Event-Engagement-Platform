import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { EVENT_CATEGORIES, EVENT_STATUS } from '@/constants/domain'
import { addHoursToTime } from '@/lib/eventDate'
import { listCategories } from '@/services/categories'
import { listVenues } from '@/services/venues'

export default function CreateEventForm({ setToast, go, actions }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Technology',
    date: '',
    time: '',
    endTime: '',
    venue: '',
    capacity: '200',
    entryFee: '0',
    securityDeposit: '0',
    currency: 'usd',
  })
  const [busy, setBusy] = useState(false)
  const [catOptions, setCatOptions] = useState([...EVENT_CATEGORIES])
  const [venueOptions, setVenueOptions] = useState([])

  useEffect(() => {
    ;(async () => {
      const [c, v] = await Promise.all([listCategories(), listVenues()])
      if (!c.error && c.data?.length) {
        setCatOptions(c.data.map((x) => x.name))
        setForm((f) => ({ ...f, category: c.data[0].name }))
      }
      if (!v.error && v.data?.length) {
        setVenueOptions(v.data)
        setForm((f) => ({ ...f, venue: v.data[0].name }))
      }
    })()
  }, [])

  const update = (key) => (e) => {
    const value = e.target.value
    if (key === 'time') {
      setForm((f) => ({
        ...f,
        time: value,
        endTime: f.endTime || (value ? addHoursToTime(value, 2) : ''),
      }))
      return
    }
    setForm({ ...form, [key]: value })
  }

  const save = async (status) => {
    if (!form.title.trim()) {
      setToast('Event title is required')
      return
    }
    if (!form.date) {
      setToast('Start date is required')
      return
    }
    if (!form.time) {
      setToast('Start time is required')
      return
    }
    const endTime = form.endTime || addHoursToTime(form.time, 2)
    if (endTime <= form.time) {
      setToast('End time must be after start time')
      return
    }
    const entryFee = Math.max(0, Number(form.entryFee) || 0)
    const securityDeposit = Math.max(0, Number(form.securityDeposit) || 0)
    setBusy(true)
    const { error } = await actions.createEvent(
      {
        ...form,
        endTime,
        entryFee,
        securityDeposit,
        currency: form.currency || 'usd',
      },
      status === 'Draft' ? EVENT_STATUS.DRAFT : EVENT_STATUS.PENDING,
    )
    setBusy(false)
    if (error) {
      setToast(error.message)
      return
    }
    setToast(status === 'Draft' ? 'Draft saved' : 'Event submitted for admin approval')
    go('/organizer/events')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Build a gathering</div>
          <h1>Create event</h1>
          <p>Set start and end time so students see Live status and certificates unlock after the event.</p>
        </div>
        <button className="btn btn-quiet" type="button" onClick={() => go('/organizer/events')}>
          <ArrowLeft size={14} /> Cancel
        </button>
      </div>
      <div className="surface" style={{ padding: 22 }}>
        <div className="eyebrow">01 · Basic information</div>
        <div className="form-grid" style={{ marginTop: 18 }}>
          <div className="full">
            <label className="label">Event title</label>
            <input className="input" value={form.title} onChange={update('title')} placeholder="Name the moment" data-testid="input-event-title" />
          </div>
          <div className="full">
            <label className="label">Description</label>
            <textarea className="input" rows={4} value={form.description} onChange={update('description')} placeholder="What should people feel when they leave?" data-testid="input-event-description" />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={update('category')}>
              {catOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Venue</label>
            <select className="input" value={form.venue} onChange={update('venue')}>
              {venueOptions.length ? (
                venueOptions.map((v) => (
                  <option key={v.id || v.name}>{v.name}</option>
                ))
              ) : (
                <option value="">Add venues from Venues page first</option>
              )}
            </select>
          </div>
          <div>
            <label className="label">Start date</label>
            <input className="input" type="date" value={form.date} onChange={update('date')} data-testid="input-event-date" />
          </div>
          <div>
            <label className="label">Start time</label>
            <input className="input" type="time" value={form.time} onChange={update('time')} data-testid="input-event-time" />
          </div>
          <div>
            <label className="label">End time</label>
            <input className="input" type="time" value={form.endTime} onChange={update('endTime')} data-testid="input-event-end-time" />
            <p className="subtle" style={{ fontSize: 10, marginTop: 4 }}>Defaults to +2 hours from start. Certificates unlock after end.</p>
          </div>
          <div>
            <label className="label">Capacity</label>
            <input className="input" type="number" value={form.capacity} onChange={update('capacity')} />
          </div>
          <div>
            <label className="label">Entry fee (USD)</label>
            <input className="input" type="number" min="0" step="0.01" value={form.entryFee} onChange={update('entryFee')} data-testid="input-event-fee" />
          </div>
          <div>
            <label className="label">Security deposit (USD, refundable)</label>
            <input className="input" type="number" min="0" step="0.01" value={form.securityDeposit} onChange={update('securityDeposit')} data-testid="input-event-deposit" />
            <p className="subtle" style={{ fontSize: 10, marginTop: 4 }}>
              Leave both at 0 for free registration. Deposit refunds when marked Present (Stripe sandbox).
            </p>
          </div>
        </div>
        {(Number(form.entryFee) > 0 || Number(form.securityDeposit) > 0) && (
          <p className="muted" style={{ fontSize: 12, marginTop: 14 }} data-testid="text-pricing-preview">
            Student pays $
            {(Number(form.entryFee || 0) + Number(form.securityDeposit || 0)).toFixed(2)}
            {Number(form.securityDeposit) > 0
              ? ` ($${Number(form.securityDeposit).toFixed(2)} refundable deposit)`
              : ''}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 23 }}>
          <button className="btn" type="button" disabled={busy} onClick={() => save('Draft')} data-testid="button-save-draft">
            Save draft
          </button>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => save('Pending')} data-testid="button-submit-event">
            Submit for approval <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  )
}
