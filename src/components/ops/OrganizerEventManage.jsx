import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { EVENT_CATEGORIES, EVENT_STATUS, DEFAULT_EVENT_CURRENCY } from '@/constants/domain'
import { addDaysToDate } from '@/lib/eventDate'
import { isoToLocalDateTimeParts, localDateTimeToIso } from '@/lib/eventMappers'
import { listCategories } from '@/services/categories'
import { listVenues } from '@/services/venues'
import { EventVisualFields } from '@/components/design-system'

/** HTML date input needs YYYY-MM-DD — DB sometimes returns ISO timestamps. */
function toDateInput(value) {
  if (!value) return ''
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** HTML time input needs HH:MM — Postgres often returns HH:MM:SS(.sss). */
function toTimeInput(value) {
  if (!value) return ''
  const m = String(value).trim().match(/(\d{1,2}):(\d{2})/)
  if (!m) return ''
  return `${String(m[1]).padStart(2, '0')}:${m[2]}`
}

function buildEditForm(event) {
  const closeParts = isoToLocalDateTimeParts(event?.registrationClosesAt)
  const date = toDateInput(event?.date)
  return {
    title: event?.title || '',
    description: event?.description || '',
    category: event?.category || 'Technology',
    date,
    time: toTimeInput(event?.time),
    endTime: toTimeInput(event?.endTime),
    venue: event?.venue || '',
    capacity: String(event?.capacity ?? 100),
    publicCapacity: String(event?.publicCapacity ?? 0),
    allowPublicGuests: Number(event?.publicCapacity ?? 0) > 0,
    rules: event?.rules || '',
    entryFee: String(event?.entryFee ?? 0),
    securityDeposit: String(event?.securityDeposit ?? 0),
    bannerUrl: event?.bannerUrl || '',
    characterKey: event?.characterKey || '',
    characterUrl: event?.characterUrl || '',
    isPromoted: Boolean(event?.isPromoted),
    registrationClosesDate: closeParts.date || date || '',
    registrationClosesTime: closeParts.time || '23:59',
    extendReason: '',
  }
}

function CenterModal({ title, onClose, children }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      data-es-no-reveal
      style={{ zIndex: 10050, pointerEvents: 'auto' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        data-es-reveal-skip
        data-es-no-reveal
        style={{ pointerEvents: 'auto' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
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
  const [form, setForm] = useState(() => buildEditForm(event))
  const [postpone, setPostpone] = useState(() => ({
    date: addDaysToDate(toDateInput(event?.date), 7),
    time: toTimeInput(event?.time),
    reason: '',
    days: '7',
  }))
  const [reason, setReason] = useState('')

  // Re-hydrate when opening a different event (parent may keep this component mounted)
  useEffect(() => {
    if (!event?.id) return
    setForm(buildEditForm(event))
    setPostpone({
      date: addDaysToDate(toDateInput(event.date), 7),
      time: toTimeInput(event.time),
      reason: '',
      days: '7',
    })
    setReason('')
  }, [event?.id])

  useEffect(() => {
    ;(async () => {
      const [c, v] = await Promise.all([listCategories(), listVenues()])
      if (!c.error && c.data?.length) setCatOptions(c.data.map((x) => x.name))
      if (!v.error && v.data?.length) setVenueOptions(v.data)
    })()
  }, [])

  if (!event || !mode) return null

  const update = (key) => (e) => {
    const value = e?.target?.value ?? ''
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const venueNames = venueOptions.map((v) => v.name).filter(Boolean)
  const venueSelectOptions =
    form.venue && !venueNames.includes(form.venue)
      ? [{ id: '__current', name: form.venue }, ...venueOptions]
      : venueOptions

  const categorySelectOptions =
    form.category && !catOptions.includes(form.category)
      ? [form.category, ...catOptions]
      : catOptions

  async function saveEdit() {
    if (!form.title.trim()) {
      setToast?.('Event title is required')
      return
    }
    if (!form.date) {
      setToast?.('Start date is required')
      return
    }
    if (!form.registrationClosesDate) {
      setToast?.('Registration close date is required')
      return
    }
    const registrationClosesAt = localDateTimeToIso(
      form.registrationClosesDate,
      form.registrationClosesTime || '23:59',
    )
    if (!registrationClosesAt) {
      setToast?.('Invalid registration close date/time')
      return
    }
    const eventStart = localDateTimeToIso(form.date, form.time || '23:59')
    if (eventStart && new Date(registrationClosesAt) > new Date(eventStart)) {
      setToast?.('Registration must close on or before the event start')
      return
    }

    if (typeof actions?.updateEvent !== 'function') {
      setToast?.('Update action unavailable — refresh and try again')
      return
    }

    const oldTs = event.registrationClosesAt
      ? new Date(event.registrationClosesAt).getTime()
      : null
    const newTs = new Date(registrationClosesAt).getTime()
    const isExtension = oldTs == null || newTs > oldTs

    const patch = {
      title: form.title.trim(),
      description: form.description,
      category: form.category,
      date: form.date,
      time: form.time || null,
      endTime: form.endTime || null,
      venue: form.venue,
      capacity: form.capacity,
      publicCapacity: form.allowPublicGuests
        ? Math.max(0, Number(form.publicCapacity) || 0)
        : 0,
      rules: form.rules,
      entryFee: Math.max(0, Number(form.entryFee) || 0),
      securityDeposit: Math.max(0, Number(form.securityDeposit) || 0),
      currency: DEFAULT_EVENT_CURRENCY,
      bannerUrl: form.bannerUrl?.trim() || null,
      characterKey: form.characterKey || null,
      characterUrl: form.characterUrl?.trim() || null,
      isPromoted: Boolean(form.isPromoted),
      promotedUntil: form.isPromoted
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      promotionTier: 'standard',
    }

    setBusy(true)
    if (isExtension && actions.extendRegistrationDeadline) {
      const { error } = await actions.extendRegistrationDeadline(event.id, {
        registrationClosesAt,
        reason: form.extendReason,
        createdBy: user?.id,
        title: form.title.trim() || event.title,
      })
      if (error) {
        setBusy(false)
        setToast?.(error.message)
        return
      }
      const { error: updErr } = await actions.updateEvent(event.id, patch)
      setBusy(false)
      if (updErr) {
        setToast?.(updErr.message)
        return
      }
      setToast?.('Event updated. Registration extended — all students notified.')
      onClose?.()
      return
    }

    const { error } = await actions.updateEvent(event.id, {
      ...patch,
      registrationClosesAt,
    })
    setBusy(false)
    if (error) {
      setToast?.(error.message)
      return
    }
    setToast?.('Event updated')
    onClose?.()
  }

  async function saveExtendRegistration() {
    if (!form.registrationClosesDate) {
      setToast?.('Pick a new registration close date')
      return
    }
    const registrationClosesAt = localDateTimeToIso(
      form.registrationClosesDate,
      form.registrationClosesTime || '23:59',
    )
    const oldTs = event.registrationClosesAt
      ? new Date(event.registrationClosesAt).getTime()
      : 0
    if (new Date(registrationClosesAt).getTime() <= oldTs) {
      setToast?.('New close time must be later than the current one')
      return
    }
    setBusy(true)
    const { error, notified } = await actions.extendRegistrationDeadline(event.id, {
      registrationClosesAt,
      reason: form.extendReason,
      createdBy: user?.id,
      title: event.title,
    })
    setBusy(false)
    if (error) {
      setToast?.(error.message)
      return
    }
    setToast?.(
      `Registration extended. ${notified != null ? `${notified} students notified.` : 'Students notified.'}`,
    )
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
              onChange={(e) => setPostpone((p) => ({ ...p, date: e.target.value }))}
              data-testid="input-postpone-date"
            />
          </div>
          <div>
            <label className="label">New time</label>
            <input
              className="input"
              type="time"
              value={postpone.time}
              onChange={(e) => setPostpone((p) => ({ ...p, time: e.target.value }))}
            />
          </div>
          <div className="full">
            <label className="label">Reason (shown in notification)</label>
            <textarea
              className="input"
              rows={3}
              value={postpone.reason}
              onChange={(e) => setPostpone((p) => ({ ...p, reason: e.target.value }))}
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
          <input
            className="input"
            value={form.title}
            onChange={update('title')}
            autoFocus
            data-testid="input-edit-event-title"
          />
        </div>
        <div className="full">
          <label className="label">Description</label>
          <textarea className="input" rows={3} value={form.description} onChange={update('description')} />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category} onChange={update('category')}>
            {categorySelectOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Venue</label>
          <select className="input" value={form.venue} onChange={update('venue')}>
            {venueSelectOptions.length ? (
              venueSelectOptions.map((v) => (
                <option key={v.id || v.name} value={v.name}>
                  {v.name}
                </option>
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
          <label className="label">Student capacity</label>
          <input className="input" type="number" min={0} value={form.capacity} onChange={update('capacity')} />
        </div>
        <div className="full">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(form.allowPublicGuests)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  allowPublicGuests: e.target.checked,
                  publicCapacity: e.target.checked && Number(f.publicCapacity) <= 0 ? '25' : f.publicCapacity,
                }))
              }
              data-testid="checkbox-edit-allow-public-guests"
            />
            Allow public guests on website
          </label>
        </div>
        {form.allowPublicGuests ? (
          <div>
            <label className="label">Public guest capacity</label>
            <input className="input" type="number" min={1} value={form.publicCapacity} onChange={update('publicCapacity')} data-testid="input-edit-public-capacity" />
          </div>
        ) : null}
        <div>
          <label className="label">Entry fee (PKR)</label>
          <input className="input" type="number" min="0" step="1" value={form.entryFee} onChange={update('entryFee')} data-testid="input-edit-event-fee" />
        </div>
        <div>
          <label className="label">Security deposit (PKR)</label>
          <input className="input" type="number" min="0" step="0.01" value={form.securityDeposit} onChange={update('securityDeposit')} data-testid="input-edit-event-deposit" />
        </div>
        <div>
          <label className="label">Registration closes (date)</label>
          <input
            className="input"
            type="date"
            value={form.registrationClosesDate}
            max={form.date || undefined}
            onChange={update('registrationClosesDate')}
            data-testid="input-edit-registration-closes-date"
          />
        </div>
        <div>
          <label className="label">Registration closes (time)</label>
          <input
            className="input"
            type="time"
            value={form.registrationClosesTime}
            onChange={update('registrationClosesTime')}
            data-testid="input-edit-registration-closes-time"
          />
        </div>
        <div className="full">
          <label className="label">If extending close date — note to students (optional)</label>
          <input
            className="input"
            value={form.extendReason}
            onChange={update('extendReason')}
            placeholder="Venue confirmed later slots, more seats opened…"
          />
          <p className="subtle" style={{ fontSize: 10, marginTop: 4 }}>
            Moving the deadline later notifies every student on EventSphere.
          </p>
        </div>
        <div className="full">
          <label className="label">Rules</label>
          <textarea className="input" rows={2} value={form.rules} onChange={update('rules')} />
        </div>
        <EventVisualFields
          bannerUrl={form.bannerUrl}
          characterKey={form.characterKey}
          characterUrl={form.characterUrl}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
        <div className="full">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(form.isPromoted)}
              onChange={(e) => setForm((f) => ({ ...f, isPromoted: e.target.checked }))}
              data-testid="checkbox-promote-event"
            />
            Feature on homepage / Recommended slider (14 days)
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        <button className="btn" type="button" style={{ flex: 1 }} onClick={onClose}>Close</button>
        <button className="btn" type="button" style={{ flex: 1 }} disabled={busy} onClick={saveExtendRegistration} data-testid="button-extend-registration">
          {busy ? 'Saving…' : 'Extend registration only'}
        </button>
        <button className="btn btn-primary" type="button" style={{ flex: 1 }} disabled={busy} onClick={saveEdit} data-testid="button-save-edit-event">
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </CenterModal>
  )
}
