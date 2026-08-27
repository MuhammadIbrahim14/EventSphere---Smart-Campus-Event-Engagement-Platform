import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { EVENT_CATEGORIES, EVENT_STATUS, DEFAULT_EVENT_CURRENCY } from '@/constants/domain'
import { addHoursToTime } from '@/lib/eventDate'
import {
  localDateTimeToIso,
  formatMoney,
  validateEarlyBirdPricing,
} from '@/lib/eventMappers'
import { listCategories } from '@/services/categories'
import { listVenues } from '@/services/venues'
import { EventVisualFields } from '@/components/design-system'

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
    publicCapacity: '0',
    allowPublicGuests: false,
    entryFee: '0',
    earlyBirdEnabled: false,
    earlyBirdFee: '',
    earlyBirdUntilDate: '',
    earlyBirdUntilTime: '23:59',
    securityDeposit: '0',
    currency: DEFAULT_EVENT_CURRENCY,
    bannerUrl: '',
    characterKey: '',
    characterUrl: '',
    registrationClosesDate: '',
    registrationClosesTime: '23:59',
  })
  const [busy, setBusy] = useState(false)
  const [catOptions, setCatOptions] = useState([...EVENT_CATEGORIES])
  const [venueOptions, setVenueOptions] = useState([])

  useEffect(() => {
    ;(async () => {
      const [c, v] = await Promise.all([listCategories(), listVenues()])
      if (!c.error && c.data?.length) {
        setCatOptions(c.data.map((x) => x.name))
        setForm((f) => ({ ...f, category: f.category || c.data[0].name }))
      }
      if (!v.error && v.data?.length) {
        setVenueOptions(v.data)
        setForm((f) => ({ ...f, venue: f.venue || v.data[0].name }))
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
    if (key === 'date') {
      setForm((f) => ({
        ...f,
        date: value,
        registrationClosesDate: f.registrationClosesDate || value,
      }))
      return
    }
    setForm((f) => ({ ...f, [key]: value }))
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
    if (!form.registrationClosesDate) {
      setToast('Registration close date is required')
      return
    }
    const registrationClosesAt = localDateTimeToIso(
      form.registrationClosesDate,
      form.registrationClosesTime || '23:59',
    )
    if (!registrationClosesAt) {
      setToast('Invalid registration close date/time')
      return
    }
    const eventStart = localDateTimeToIso(form.date, form.time || '00:00')
    if (eventStart && new Date(registrationClosesAt) > new Date(eventStart)) {
      setToast('Registration must close on or before the event start')
      return
    }
    const entryFee = Math.max(0, Number(form.entryFee) || 0)
    const securityDeposit = Math.max(0, Number(form.securityDeposit) || 0)
    let earlyBirdFee = null
    let earlyBirdUntil = null
    if (form.earlyBirdEnabled) {
      earlyBirdUntil = localDateTimeToIso(
        form.earlyBirdUntilDate || form.date,
        form.earlyBirdUntilTime || '23:59',
      )
      earlyBirdFee = Math.max(0, Number(form.earlyBirdFee) || 0)
      const earlyErr = validateEarlyBirdPricing({
        entryFee,
        earlyBirdFee,
        earlyBirdUntil,
        eventStartIso: eventStart,
      })
      if (earlyErr) {
        setToast(earlyErr)
        return
      }
    }
    setBusy(true)
    const { error } = await actions.createEvent(
      {
        ...form,
        endTime,
        entryFee,
        earlyBirdFee,
        earlyBirdUntil,
        securityDeposit,
        currency: form.currency || DEFAULT_EVENT_CURRENCY,
        publicCapacity: form.allowPublicGuests
          ? Math.max(0, Number(form.publicCapacity) || 0)
          : 0,
        bannerUrl: form.bannerUrl?.trim() || null,
        characterKey: form.characterKey || null,
        characterUrl: form.characterUrl?.trim() || null,
        registrationClosesAt,
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
      <div className="surface" style={{ padding: 22 }} data-es-no-reveal>
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
            <label className="label">Student capacity</label>
            <input className="input" type="number" min={0} value={form.capacity} onChange={update('capacity')} data-testid="input-student-capacity" />
            <p className="subtle" style={{ fontSize: 10, marginTop: 4 }}>Campus students only — separate from public pool.</p>
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
                data-testid="checkbox-allow-public-guests"
              />
              Allow public guests (teachers, family, visitors)
            </label>
            <p className="subtle" style={{ fontSize: 10, marginTop: 4 }}>
              When off, the event stays campus-only and will not appear on the public website.
            </p>
          </div>
          {form.allowPublicGuests ? (
            <div>
              <label className="label">Public guest capacity</label>
              <input className="input" type="number" min={1} value={form.publicCapacity} onChange={update('publicCapacity')} data-testid="input-public-capacity" />
            </div>
          ) : null}
          <div>
            <label className="label">Registration closes (date)</label>
            <input
              className="input"
              type="date"
              value={form.registrationClosesDate}
              max={form.date || undefined}
              onChange={update('registrationClosesDate')}
              data-testid="input-registration-closes-date"
            />
          </div>
          <div>
            <label className="label">Registration closes (time)</label>
            <input
              className="input"
              type="time"
              value={form.registrationClosesTime}
              onChange={update('registrationClosesTime')}
              data-testid="input-registration-closes-time"
            />
            <p className="subtle" style={{ fontSize: 10, marginTop: 4 }}>
              After this, students cannot register. You can extend later — all students get notified.
            </p>
          </div>
          <div>
            <label className="label">Regular entry fee (PKR)</label>
            <input className="input" type="number" min="0" step="1" value={form.entryFee} onChange={update('entryFee')} data-testid="input-event-fee" />
            <p className="subtle" style={{ fontSize: 10, marginTop: 4 }}>
              Price after early bird ends (or always, if early bird is off).
            </p>
          </div>
          <div>
            <label className="label">Security deposit (PKR, refundable)</label>
            <input className="input" type="number" min="0" step="0.01" value={form.securityDeposit} onChange={update('securityDeposit')} data-testid="input-event-deposit" />
            <p className="subtle" style={{ fontSize: 10, marginTop: 4 }}>
              Leave fee + deposit at 0 for free registration. Deposit refunds when marked Present.
            </p>
          </div>
          <div className="full">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(form.earlyBirdEnabled)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    earlyBirdEnabled: e.target.checked,
                    earlyBirdUntilDate: f.earlyBirdUntilDate || f.registrationClosesDate || f.date,
                    earlyBirdFee:
                      f.earlyBirdFee ||
                      (Number(f.entryFee) > 0 ? String(Math.max(0, Math.floor(Number(f.entryFee) * 0.8))) : ''),
                  }))
                }
                data-testid="checkbox-early-bird"
              />
              Enable early-bird pricing
            </label>
          </div>
          {form.earlyBirdEnabled ? (
            <>
              <div>
                <label className="label">Early-bird fee (PKR)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  value={form.earlyBirdFee}
                  onChange={update('earlyBirdFee')}
                  data-testid="input-early-bird-fee"
                />
                <p className="subtle" style={{ fontSize: 10, marginTop: 4 }}>
                  Must be lower than regular fee.
                </p>
              </div>
              <div>
                <label className="label">Early bird ends (date)</label>
                <input
                  className="input"
                  type="date"
                  value={form.earlyBirdUntilDate}
                  max={form.date || undefined}
                  onChange={update('earlyBirdUntilDate')}
                  data-testid="input-early-bird-until-date"
                />
              </div>
              <div>
                <label className="label">Early bird ends (time)</label>
                <input
                  className="input"
                  type="time"
                  value={form.earlyBirdUntilTime}
                  onChange={update('earlyBirdUntilTime')}
                  data-testid="input-early-bird-until-time"
                />
              </div>
            </>
          ) : null}
        </div>

        <div style={{ marginTop: 22 }}>
          <EventVisualFields
            bannerUrl={form.bannerUrl}
            characterKey={form.characterKey}
            characterUrl={form.characterUrl}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          />
        </div>

        {(Number(form.entryFee) > 0 || Number(form.securityDeposit) > 0 || form.earlyBirdEnabled) && (
          <p className="muted" style={{ fontSize: 12, marginTop: 14 }} data-testid="text-pricing-preview">
            {form.earlyBirdEnabled && Number(form.entryFee) > 0 ? (
              <>
                Early bird{' '}
                <strong>
                  {formatMoney(Number(form.earlyBirdFee) || 0, form.currency || DEFAULT_EVENT_CURRENCY)}
                </strong>
                {' → '}
                regular{' '}
                <strong>
                  {formatMoney(Number(form.entryFee) || 0, form.currency || DEFAULT_EVENT_CURRENCY)}
                </strong>
                {Number(form.securityDeposit) > 0
                  ? ` + deposit ${formatMoney(Number(form.securityDeposit) || 0, form.currency || DEFAULT_EVENT_CURRENCY)}`
                  : ''}
              </>
            ) : (
              <>
                Attendee pays{' '}
                <strong>
                  {formatMoney(
                    Number(form.entryFee || 0) + Number(form.securityDeposit || 0),
                    form.currency || DEFAULT_EVENT_CURRENCY,
                  )}
                </strong>
                {Number(form.securityDeposit) > 0 ? ' (includes refundable deposit)' : ''}
              </>
            )}
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
