import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { EVENT_CATEGORIES, EVENT_STATUS } from '@/constants/domain'
import { addDaysToDate } from '@/lib/eventDate'
import { listCategories } from '@/services/categories'
import { listVenues } from '@/services/venues'

function CenterModal({ title, onClose, children }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      style={{ zIndex: 200 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Organizer event management modals: edit | postpone | cancel | delete
 */
export default function OrganizerEventManage({ mode, event, actions, setToast, onClose, onSwitchMode }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [catOptions, setCatOptions] = useState([...EVENT_CATEGORIES])
  const [venueOptions, setVenueOptions] = useState([])
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    category: event?.category || 'Technology',
    date: event?.date || '',
    time: event?.time || '',
    endTime: event?.endTime || '',
    venue: event?.venue || '',
    capacity: String(event?.capacity ?? 100),
    rules: event?.rules || '',
    entryFee: String(event?.entryFee ?? 0),
    securityDeposit: String(event?.securityDeposit ?? 0),
  })
  const [postpone, setPostpone] = useState({
    date: addDaysToDate(event?.date, 7),
    time: event?.time || '',
    reason: '',
    days: '7',
  })
  const [reason, setReason] = useState('')

  useEffect(() => {
    ;(async () => {
      const [c, v] = await Promise.all([listCategories(), listVenues()])
      if (!c.error && c.data?.length) setCatOptions(c.data.map((x) => x.name))
      if (!v.error && v.data?.length) setVenueOptions(v.data)
    })()
  }, [])

  if (!event || !mode) return null

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function saveEdit() {
    if (!form.title.trim()) {
      setToast?.('Event title is required')
      return
    }
    if (!form.date) {
      setToast?.('Start date is required')
      return
    }
    setBusy(true)
    const { error } = await actions.updateEvent(event.id, {
      title: form.title.trim(),
      description: form.description,
      category: form.category,
      date: form.date,
      time: form.time,
      endTime: form.endTime,
      venue: form.venue,
      capacity: form.capacity,
      rules: form.rules,
      entryFee: Math.max(0, Number(form.entryFee) || 0),
      securityDeposit: Math.max(0, Number(form.securityDeposit) || 0),
      currency: 'usd',
    })
    setBusy(false)
    if (error) {
      setToast?.(error.message)
      return
    }
    setToast?.('Event updated')
    onClose?.()
  }

  async function savePostpone() {
    if (!postpone.date) {
      setToast?.('New date is required')
      return
    }
    const current = String(event.date || '').slice(0, 10)
    if (postpone.date <= current) {
      setToast?.('Postpone date must be after the current event date')
      return
    }
    setBusy(true)
    const { error } = await actions.postponeEvent(event.id, {
      date: postpone.date,
      time: postpone.time || event.time || '',
      reason: postpone.reason,
      createdBy: user?.id,
      title: event.title,
    })
    setBusy(false)
    if (error) {
      // Date may still have updated — show message and close so UI can refresh
      setToast?.(error.message)
      onClose?.()
      return
    }
    setToast?.(`Event postponed to ${postpone.date}. Students notified.`)
    onClose?.()
  }

  async function saveCancel() {
    setBusy(true)
    const { error } = await actions.cancelEvent(event.id, {
      reason,
      createdBy: user?.id,
      title: event.title,
    })
    setBusy(false)
    if (error) {
      const fallback = await actions.setStatus(event.id, EVENT_STATUS.CANCELLED)
      if (fallback.error) {
        setToast?.(error.message)
        return
      }
      setToast?.('Event cancelled (notification may have failed)')
      onClose?.()
      return
    }
    setToast?.('Event cancelled. Students notified.')
    onClose?.()
  }

  async function saveDelete() {
    if (!confirm(`Permanently delete "${event.title}"? This cannot be undone.`)) return
    setBusy(true)
    const { error } = await actions.deleteEvent(event.id)
    setBusy(false)
    if (error) {
      setToast?.(error.message)
      return
    }
    setToast?.('Event deleted')
    onClose?.()
  }

  if (mode === 'delete') {
    const hasRegs = Number(event.registrations || 0) > 0
    const isLive = ['Approved', 'Pending'].includes(event.status)
    return (
      <CenterModal title={isLive || hasRegs ? 'Use Cancel instead' : 'Delete event'} onClose={onClose}>
        {isLive || hasRegs ? (
          <>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              This event is live or has registrations. Hard delete would wipe attendance history.
              Use <strong>Cancel event</strong> so students get a notification.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button className="btn" type="button" style={{ flex: 1 }} onClick={onClose}>Close</button>
              <button
                className="btn btn-primary"
                type="button"
                style={{ flex: 1 }}
                onClick={() => onSwitchMode?.('cancel')}
              >
                Cancel event
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 13 }}>
              Permanently remove <strong>{event.title}</strong> from your workspace?
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button className="btn" type="button" style={{ flex: 1 }} onClick={onClose}>Keep</button>
              <button className="btn btn-danger" type="button" style={{ flex: 1 }} disabled={busy} onClick={saveDelete} data-testid="button-confirm-delete-event">
                {busy ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </>
        )}
      </CenterModal>
    )
  }

  if (mode === 'cancel') {
    return (
      <CenterModal title="Cancel event" onClose={onClose}>
        <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
          Marks the event as Cancelled and notifies students. History is kept for audit.
        </p>
        <label className="label">Reason (optional)</label>
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Venue conflict, weather, …" />
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="btn" type="button" style={{ flex: 1 }} onClick={onClose}>Back</button>
          <button className="btn btn-danger" type="button" style={{ flex: 1 }} disabled={busy} onClick={saveCancel} data-testid="button-confirm-cancel-event">
            {busy ? 'Cancelling…' : 'Cancel event'}
          </button>
        </div>
      </CenterModal>
    )
  }

  if (mode === 'postpone') {
    return (
      <CenterModal title="Postpone event" onClose={onClose}>
        <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
          Current: <strong>{event.date}</strong>{event.time ? ` · ${event.time}` : ''}.
          Date moves forward and students get a notification in the bell menu.
        </p>
        <div className="form-grid">
          <div>
            <label className="label">Quick jump</label>
            <select
              className="input"
              value={postpone.days}
              onChange={(e) => {
                const days = e.target.value
                setPostpone({
                  ...postpone,
                  days,
                  date: addDaysToDate(event.date, Number(days)),
                })
              }}
            >
              <option value="7">+7 days</option>
              <option value="14">+14 days</option>
              <option value="30">+30 days</option>
            </select>
          </div>
          <div>
            <label className="label">New date</label>
            <input
              className="input"
              type="date"
              value={postpone.date}
              onChange={(e) => setPostpone({ ...postpone, date: e.target.value })}
              data-testid="input-postpone-date"
            />
          </div>
          <div>
            <label className="label">New time</label>
            <input
              className="input"
              type="time"
              value={postpone.time}
              onChange={(e) => setPostpone({ ...postpone, time: e.target.value })}
            />
          </div>
          <div className="full">
            <label className="label">Reason (shown in notification)</label>
            <textarea
              className="input"
              rows={3}
              value={postpone.reason}
              onChange={(e) => setPostpone({ ...postpone, reason: e.target.value })}
              placeholder="Why is this postponed?"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="btn" type="button" style={{ flex: 1 }} onClick={onClose}>Back</button>
          <button className="btn btn-primary" type="button" style={{ flex: 1 }} disabled={busy} onClick={savePostpone} data-testid="button-confirm-postpone">
            {busy ? 'Saving…' : 'Postpone & notify'}
          </button>
        </div>
      </CenterModal>
    )
  }

  return (
    <CenterModal title="Edit event" onClose={onClose}>
      <div className="form-grid">
        <div className="full">
          <label className="label">Event title</label>
          <input className="input" value={form.title} onChange={update('title')} data-testid="input-edit-event-title" />
        </div>
        <div className="full">
          <label className="label">Description</label>
          <textarea className="input" rows={3} value={form.description} onChange={update('description')} />
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
              <option value={form.venue}>{form.venue || '—'}</option>
            )}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={form.date} onChange={update('date')} />
        </div>
        <div>
          <label className="label">Time</label>
          <input className="input" type="time" value={form.time} onChange={update('time')} />
        </div>
        <div>
          <label className="label">End time</label>
          <input className="input" type="time" value={form.endTime} onChange={update('endTime')} />
        </div>
        <div>
          <label className="label">Capacity</label>
          <input className="input" type="number" value={form.capacity} onChange={update('capacity')} />
        </div>
        <div>
          <label className="label">Entry fee (USD)</label>
          <input className="input" type="number" min="0" step="0.01" value={form.entryFee} onChange={update('entryFee')} data-testid="input-edit-event-fee" />
        </div>
        <div>
          <label className="label">Security deposit (USD)</label>
          <input className="input" type="number" min="0" step="0.01" value={form.securityDeposit} onChange={update('securityDeposit')} data-testid="input-edit-event-deposit" />
        </div>
        <div className="full">
          <label className="label">Rules</label>
          <textarea className="input" rows={2} value={form.rules} onChange={update('rules')} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button className="btn" type="button" style={{ flex: 1 }} onClick={onClose}>Close</button>
        <button className="btn btn-primary" type="button" style={{ flex: 1 }} disabled={busy} onClick={saveEdit} data-testid="button-save-edit-event">
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </CenterModal>
  )
}
