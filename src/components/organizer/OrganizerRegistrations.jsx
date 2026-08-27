import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CreditCard,
  Download,
  RefreshCw,
  Search,
  Ticket,
  UserCheck,
  Users,
} from 'lucide-react'
import EsPageChrome from '@/components/design-system/EsPageChrome'
import EsReveal from '@/components/design-system/EsReveal'
import UserAvatar from '@/components/shared/UserAvatar'
import { PAYMENT_STATUS, PAYMENT_STATUS_LABEL, REGISTRATION_STATUS } from '@/constants/domain'
import { attendeeAudience } from '@/constants/roles'
import { downloadCsv } from '@/lib/csvExport'
import { formatMoney } from '@/lib/eventMappers'

const STATUS_FILTERS = [
  { id: 'all', label: 'All statuses' },
  { id: REGISTRATION_STATUS.CONFIRMED, label: 'Confirmed' },
  { id: REGISTRATION_STATUS.WAITLIST, label: 'Waitlist' },
  { id: REGISTRATION_STATUS.PENDING, label: 'Pending' },
  { id: REGISTRATION_STATUS.PENDING_PAYMENT, label: 'Awaiting payment' },
  { id: REGISTRATION_STATUS.CANCELLED, label: 'Cancelled' },
]

const PAY_FILTERS = [
  { id: 'all', label: 'All payments' },
  { id: PAYMENT_STATUS.PAID, label: 'Paid' },
  { id: PAYMENT_STATUS.PENDING, label: 'Pending' },
  { id: PAYMENT_STATUS.NOT_REQUIRED, label: 'Free' },
  { id: PAYMENT_STATUS.PARTIALLY_REFUNDED, label: 'Deposit refunded' },
  { id: PAYMENT_STATUS.REFUNDED, label: 'Refunded' },
  { id: PAYMENT_STATUS.FORFEITED, label: 'Forfeited' },
]

const AUDIENCE_FILTERS = [
  { id: 'all', label: 'Everyone' },
  { id: 'student', label: 'Campus students' },
  { id: 'public', label: 'Public guests' },
]

function initialsFrom(name, email) {
  const base = String(name || email || 'Attendee').trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function regStatusClass(status) {
  if (status === REGISTRATION_STATUS.CONFIRMED) return 'badge-approved'
  if (status === REGISTRATION_STATUS.CANCELLED) return 'badge-cancelled'
  if (status === REGISTRATION_STATUS.WAITLIST) return 'badge-draft'
  return 'badge-pending'
}

function payStatusClass(status) {
  if (status === PAYMENT_STATUS.PAID || status === PAYMENT_STATUS.PARTIALLY_REFUNDED) {
    return 'es-org-regs__pay--ok'
  }
  if (status === PAYMENT_STATUS.PENDING) {
    return 'es-org-regs__pay--pending'
  }
  if (status === PAYMENT_STATUS.REFUNDED || status === PAYMENT_STATUS.FORFEITED) {
    return 'es-org-regs__pay--muted'
  }
  return 'es-org-regs__pay--free'
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatRegLabel(status) {
  if (!status) return 'Unknown'
  return String(status).replace(/_/g, ' ')
}

function rowAudience(r) {
  return attendeeAudience(r.student || r.profiles)
}

/**
 * Organizer registrations — event-grouped attendee cards, students | public split.
 */
export default function OrganizerRegistrations({
  rows = [],
  events = [],
  loading = false,
  onRefresh,
  setToast,
}) {
  const [q, setQ] = useState('')
  const [eventFilter, setEventFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [payFilter, setPayFilter] = useState('all')
  const [audienceFilter, setAudienceFilter] = useState('all')

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status !== REGISTRATION_STATUS.CANCELLED)
    const confirmed = rows.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED)
    const paid = rows.filter((r) =>
      [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED].includes(r.paymentStatus),
    )
    const students = active.filter((r) => rowAudience(r) === 'student').length
    const publicGuests = active.filter((r) => rowAudience(r) === 'public').length
    return {
      total: active.length,
      confirmed: confirmed.length,
      paid: paid.length,
      students,
      publicGuests,
    }
  }, [rows])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (eventFilter !== 'all' && String(r.eventId) !== String(eventFilter)) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (payFilter !== 'all' && r.paymentStatus !== payFilter) return false
      if (audienceFilter !== 'all' && rowAudience(r) !== audienceFilter) return false
      if (!needle) return true
      const hay = [
        r.student?.full_name,
        r.student?.email,
        r.student?.department,
        r.student?.enrollment_no,
        r.student?.role,
        r.eventTitle,
        r.status,
        r.paymentStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [rows, eventFilter, statusFilter, payFilter, audienceFilter, q])

  const grouped = useMemo(() => {
    const byEvent = new Map()
    for (const row of filtered) {
      const id = String(row.eventId || row.event?.id || 'unknown')
      if (!byEvent.has(id)) {
        const event = events.find((e) => String(e.id) === id)
        byEvent.set(id, {
          event,
          title: row.eventTitle || event?.title || 'Event',
          rows: [],
        })
      }
      byEvent.get(id).rows.push(row)
    }
    return Array.from(byEvent.values()).sort((a, b) => {
      const da = a.event?.date || ''
      const db = b.event?.date || ''
      if (da !== db) return da.localeCompare(db)
      return a.title.localeCompare(b.title)
    })
  }, [filtered, events])

  const exportCsv = () => {
    const { error } = downloadCsv(
      'eventsphere-organizer-registrations.csv',
      filtered.map((r) => ({
        audience: rowAudience(r),
        student: r.student?.full_name || r.studentId,
        email: r.student?.email,
        role: r.student?.role,
        department: r.student?.department,
        event: r.eventTitle || r.eventId,
        registered: r.registeredOn,
        status: r.status,
        payment: PAYMENT_STATUS_LABEL[r.paymentStatus] || r.paymentStatus,
        amount: r.amountTotal,
      })),
    )
    setToast?.(error ? error.message : 'CSV exported')
  }

  const statCards = [
    ['Total active', stats.total, 'registrations', Users, 'var(--es-ice)'],
    ['Campus students', stats.students, 'student seats', UserCheck, 'var(--es-neon)'],
    ['Public guests', stats.publicGuests, 'guest seats', Ticket, 'var(--es-sun)'],
    ['Paid', stats.paid, 'completed checkout', CreditCard, 'var(--es-hot)'],
  ]

  const renderCard = (r, event) => {
    const name = r.student?.full_name || 'Attendee'
    const email = r.student?.email || '—'
    const payLabel = PAYMENT_STATUS_LABEL[r.paymentStatus] || r.paymentStatus || 'Free'
    const amount =
      Number(r.amountTotal) > 0
        ? formatMoney(r.amountTotal, event?.currency || 'pkr')
        : null
    const audience = rowAudience(r)

    return (
      <article key={r.id} className="es-org-regs__card" data-testid={`reg-card-${r.id}`}>
        <div className="es-org-regs__card-top">
          <UserAvatar initials={initialsFrom(name, email)} size={44} title={name} />
          <div className="es-org-regs__card-id">
            <strong>{name}</strong>
            <span>{email}</span>
            {r.student?.department ? (
              <span className="es-org-regs__dept">{r.student.department}</span>
            ) : null}
          </div>
        </div>

        <div className="es-org-regs__card-badges">
          <span className={`badge ${audience === 'public' ? 'badge-draft' : 'badge-approved'}`}>
            {audience === 'public' ? 'Public guest' : 'Campus student'}
          </span>
          <span className={`badge ${regStatusClass(r.status)}`}>
            {formatRegLabel(r.status)}
          </span>
          <span
            className={`es-org-regs__pay ${payStatusClass(r.paymentStatus)}`}
            data-testid={`payment-status-${r.id}`}
          >
            {payLabel}
            {amount ? ` · ${amount}` : ''}
          </span>
        </div>

        <footer className="es-org-regs__card-foot">
          <span>Registered {formatWhen(r.registeredOn)}</span>
          {r.student?.enrollment_no ? (
            <span className="mono">#{r.student.enrollment_no}</span>
          ) : null}
        </footer>
      </article>
    )
  }

  return (
    <div className="es-org-regs" data-testid="organizer-registrations">
      <EsPageChrome
        eyebrow="02 · Attendee roster"
        title="Registrations"
        description="Campus students and public guests stay separated — grouped by gathering with live payment signals."
        action={
          <div className="es-org-regs__head-actions">
            <button
              type="button"
              className="btn"
              onClick={() => onRefresh?.()}
              disabled={loading}
              data-testid="button-refresh-regs"
            >
              <RefreshCw size={14} className={loading ? 'es-org-regs__spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={exportCsv}
              disabled={!filtered.length}
              data-testid="button-export-regs"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        }
      />

      <div className="es-role-dash__stats">
        {statCards.map(([label, value, note, Icon, color]) => (
          <EsReveal key={label} className="es-role-dash__stat" y={18}>
            <div className="es-role-dash__stat-label">
              <span>{label}</span>
              <Icon size={14} style={{ color }} />
            </div>
            <div className="es-role-dash__stat-value" style={{ color }}>
              {value}
            </div>
            <div className="subtle" style={{ fontSize: 11, marginTop: 6 }}>
              {note}
            </div>
          </EsReveal>
        ))}
      </div>

      <div className="es-org-regs__toolbar surface">
        <div className="search es-org-regs__search">
          <Search size={15} aria-hidden />
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, department…"
            data-testid="input-search-regs"
          />
        </div>
        <select
          className="input es-org-regs__select"
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          data-testid="select-event-filter"
        >
          <option value="all">All events</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title}
            </option>
          ))}
        </select>
      </div>

      <div className="es-org-regs__chips">
        <span className="es-org-regs__chip-label">Audience</span>
        {AUDIENCE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip ${audienceFilter === f.id ? 'active' : ''}`}
            onClick={() => setAudienceFilter(f.id)}
            data-testid={`chip-audience-${f.id}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="es-org-regs__chips">
        <span className="es-org-regs__chip-label">Status</span>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip ${statusFilter === f.id ? 'active' : ''}`}
            onClick={() => setStatusFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="es-org-regs__chips es-org-regs__chips--pay">
        <span className="es-org-regs__chip-label">Payment</span>
        {PAY_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip ${payFilter === f.id ? 'active' : ''}`}
            onClick={() => setPayFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="es-org-regs__loading surface">
          <RefreshCw size={18} className="es-org-regs__spin" aria-hidden />
          <p className="muted">Syncing registration roster…</p>
        </div>
      ) : null}

      {!loading && !filtered.length ? (
        <div className="es-org-regs__empty surface">
          <Ticket size={28} strokeWidth={1.5} aria-hidden />
          <h3>No registrations match</h3>
          <p className="muted">
            {rows.length
              ? 'Try clearing filters or search with a different keyword.'
              : 'When students or public guests register for your events, attendee cards will appear here grouped by event.'}
          </p>
        </div>
      ) : null}

      {!loading && grouped.length > 0 ? (
        <div className="es-org-regs__groups">
          {grouped.map(({ event, title, rows: eventRows }) => {
            const capacity = Number(event?.capacity || 0)
            const fill = capacity > 0 ? Math.min(100, Math.round((eventRows.length / capacity) * 100)) : 0
            const confirmedCount = eventRows.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED).length
            const studentRows = eventRows.filter((r) => rowAudience(r) === 'student')
            const publicRows = eventRows.filter((r) => rowAudience(r) === 'public')

            return (
              <EsReveal key={event?.id || title} className="es-org-regs__group surface" y={22}>
                <header className="es-org-regs__group-head">
                  <div>
                    <div className="eyebrow">Event roster</div>
                    <h2 className="es-org-regs__group-title">{title}</h2>
                    <p className="es-org-regs__group-meta">
                      <CalendarDays size={13} aria-hidden />
                      {event?.date || 'Date TBA'}
                      {event?.venue ? ` · ${event.venue}` : ''}
                    </p>
                  </div>
                  <div className="es-org-regs__group-stats">
                    <div>
                      <span className="es-org-regs__group-stat-val">{eventRows.length}</span>
                      <span className="es-org-regs__group-stat-lbl">Total</span>
                    </div>
                    <div>
                      <span className="es-org-regs__group-stat-val">{studentRows.length}</span>
                      <span className="es-org-regs__group-stat-lbl">Students</span>
                    </div>
                    <div>
                      <span className="es-org-regs__group-stat-val">{publicRows.length}</span>
                      <span className="es-org-regs__group-stat-lbl">Public</span>
                    </div>
                    <div>
                      <span className="es-org-regs__group-stat-val">{confirmedCount}</span>
                      <span className="es-org-regs__group-stat-lbl">Confirmed</span>
                    </div>
                    {capacity > 0 ? (
                      <div>
                        <span className="es-org-regs__group-stat-val">{capacity}</span>
                        <span className="es-org-regs__group-stat-lbl">Capacity</span>
                      </div>
                    ) : null}
                  </div>
                </header>

                {capacity > 0 ? (
                  <div className="es-org-regs__fill">
                    <div className="progress">
                      <span style={{ width: `${fill}%` }} />
                    </div>
                    <span className="es-org-regs__fill-label">{fill}% filled</span>
                  </div>
                ) : null}

                <div className="es-org-regs__audience-split">
                  <section className="es-org-regs__audience-col">
                    <div className="es-org-regs__audience-head">
                      <h3>Campus students</h3>
                      <span className="eyebrow">{studentRows.length}</span>
                    </div>
                    {studentRows.length ? (
                      <div className="es-org-regs__cards">
                        {studentRows.map((r) => renderCard(r, event))}
                      </div>
                    ) : (
                      <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
                        No campus students in this view.
                      </p>
                    )}
                  </section>
                  <section className="es-org-regs__audience-col">
                    <div className="es-org-regs__audience-head">
                      <h3>Public guests</h3>
                      <span className="eyebrow">{publicRows.length}</span>
                    </div>
                    {publicRows.length ? (
                      <div className="es-org-regs__cards">
                        {publicRows.map((r) => renderCard(r, event))}
                      </div>
                    ) : (
                      <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
                        No public guests in this view.
                      </p>
                    )}
                  </section>
                </div>
              </EsReveal>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
