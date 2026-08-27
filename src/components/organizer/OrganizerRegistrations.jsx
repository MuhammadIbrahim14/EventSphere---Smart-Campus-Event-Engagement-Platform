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

/**
 * Organizer registrations — event-grouped attendee cards (presentation only).
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

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status !== REGISTRATION_STATUS.CANCELLED)
    const confirmed = rows.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED)
    const waitlist = rows.filter((r) => r.status === REGISTRATION_STATUS.WAITLIST)
    const paid = rows.filter((r) =>
      [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED].includes(r.paymentStatus),
    )
    return {
      total: active.length,
      confirmed: confirmed.length,
      waitlist: waitlist.length,
      paid: paid.length,
    }
  }, [rows])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (eventFilter !== 'all' && String(r.eventId) !== String(eventFilter)) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (payFilter !== 'all' && r.paymentStatus !== payFilter) return false
      if (!needle) return true
      const hay = [
        r.student?.full_name,
        r.student?.email,
        r.student?.department,
        r.student?.enrollment_no,
        r.eventTitle,
        r.status,
        r.paymentStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [rows, eventFilter, statusFilter, payFilter, q])

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
        student: r.student?.full_name || r.studentId,
        email: r.student?.email,
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
    ['Confirmed', stats.confirmed, 'seats held', UserCheck, 'var(--es-neon)'],
    ['Waitlist', stats.waitlist, 'in queue', Ticket, 'var(--es-sun)'],
    ['Paid', stats.paid, 'completed checkout', CreditCard, 'var(--es-hot)'],
  ]

  return (
    <div className="es-org-regs" data-testid="organizer-registrations">
      <EsPageChrome
        eyebrow="02 · Attendee roster"
        title="Registrations"
        description="Every seat claimed across your events — grouped by gathering with live payment signals."
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
              : 'When students register for your events, attendee cards will appear here grouped by event.'}
          </p>
        </div>
      ) : null}

      {!loading && grouped.length > 0 ? (
        <div className="es-org-regs__groups">
          {grouped.map(({ event, title, rows: eventRows }) => {
            const capacity = Number(event?.capacity || 0)
            const fill = capacity > 0 ? Math.min(100, Math.round((eventRows.length / capacity) * 100)) : 0
            const confirmedCount = eventRows.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED).length

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

                <div className="es-org-regs__cards">
                  {eventRows.map((r) => {
                    const name = r.student?.full_name || 'Attendee'
                    const email = r.student?.email || '—'
                    const payLabel = PAYMENT_STATUS_LABEL[r.paymentStatus] || r.paymentStatus || 'Free'
                    const amount =
                      Number(r.amountTotal) > 0
                        ? formatMoney(r.amountTotal, event?.currency || 'pkr')
                        : null

                    return (
                      <article key={r.id} className="es-org-regs__card" data-testid={`reg-card-${r.id}`}>
                        <div className="es-org-regs__card-top">
                          <UserAvatar
                            initials={initialsFrom(name, email)}
                            size={44}
                            title={name}
                          />
                          <div className="es-org-regs__card-id">
                            <strong>{name}</strong>
                            <span>{email}</span>
                            {r.student?.department ? (
                              <span className="es-org-regs__dept">{r.student.department}</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="es-org-regs__card-badges">
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
                  })}
                </div>
              </EsReveal>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
