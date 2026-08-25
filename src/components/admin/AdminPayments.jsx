/**
 * Admin — Stripe sandbox payment management.
 * Uses existing Edge Functions only (confirm / refund-deposit). Does not alter student checkout.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { PAYMENT_STATUS, PAYMENT_STATUS_LABEL } from '@/constants/domain'
import { downloadCsv } from '@/lib/csvExport'
import { listAllRegistrations } from '@/services/registrations'
import {
  confirmCheckoutSession,
  listAllPayments,
  processRegistrationPayment,
  refundEventPayments,
} from '@/services/payments'

const STATUS_FILTERS = [
  { id: 'all', label: 'All priced' },
  { id: 'pending', label: 'Pending' },
  { id: 'paid', label: 'Paid' },
  { id: 'partially_refunded', label: 'Deposit refunded' },
  { id: 'refunded', label: 'Fully refunded' },
  { id: 'forfeited', label: 'Forfeited' },
  { id: 'expired', label: 'Expired' },
]

function money(n, currency = 'usd') {
  const v = Number(n || 0)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: String(currency || 'usd').toUpperCase(),
    }).format(v)
  } catch {
    return `$${v.toFixed(2)}`
  }
}

export default function AdminPayments({ events = [], setToast }) {
  const [tab, setTab] = useState('bookings')
  const [regs, setRegs] = useState([])
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [q, setQ] = useState('')
  const [busyKey, setBusyKey] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [regsRes, payRes] = await Promise.all([
      listAllRegistrations(),
      listAllPayments(),
    ])
    if (regsRes.error) setToast?.(regsRes.error.message)
    if (payRes.error) setToast?.(payRes.error.message)
    setRegs(regsRes.data || [])
    setLedger(payRes.data || [])
    setLoading(false)
  }, [setToast])

  useEffect(() => {
    load()
  }, [load])

  const pricedRegs = useMemo(
    () =>
      (regs || []).filter(
        (r) =>
          r.paymentStatus &&
          r.paymentStatus !== PAYMENT_STATUS.NOT_REQUIRED &&
          (Number(r.amountTotal) > 0 ||
            Number(r.feeAmount) > 0 ||
            Number(r.depositAmount) > 0 ||
            r.paymentStatus === PAYMENT_STATUS.PENDING),
      ),
    [regs],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return pricedRegs.filter((r) => {
      if (statusFilter !== 'all' && r.paymentStatus !== statusFilter) return false
      if (eventFilter !== 'all' && String(r.eventId) !== String(eventFilter)) return false
      if (!needle) return true
      const hay = [
        r.student?.full_name,
        r.student?.email,
        r.eventTitle,
        r.organizerName,
        r.id,
        r.stripePaymentIntentId,
        r.stripeCheckoutSessionId,
        r.paymentStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [pricedRegs, statusFilter, eventFilter, q])

  const stats = useMemo(() => {
    const paid = pricedRegs.filter((r) =>
      [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED].includes(r.paymentStatus),
    )
    const pending = pricedRegs.filter((r) => r.paymentStatus === PAYMENT_STATUS.PENDING)
    const refunded = pricedRegs.filter((r) =>
      [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED].includes(r.paymentStatus),
    )
    const forfeited = pricedRegs.filter((r) => r.paymentStatus === PAYMENT_STATUS.FORFEITED)
    const collected = paid.reduce((s, r) => s + Number(r.amountTotal || 0), 0)
    return {
      paid: paid.length,
      pending: pending.length,
      refunded: refunded.length,
      forfeited: forfeited.length,
      collected,
      ledgerCount: ledger.length,
    }
  }, [pricedRegs, ledger])

  const pricedEvents = useMemo(() => {
    const ids = new Set(pricedRegs.map((r) => String(r.eventId)))
    return (events || []).filter((e) => ids.has(String(e.id)))
  }, [events, pricedRegs])

  const runAction = async (key, fn, okMsg) => {
    setBusyKey(key)
    try {
      const { error } = await fn()
      if (error) {
        setToast?.(error.message || 'Action failed')
        return
      }
      setToast?.(okMsg)
      await load()
    } finally {
      setBusyKey(null)
    }
  }

  const exportBookings = () => {
    const { error } = downloadCsv(
      'eventsphere-payments-bookings.csv',
      filtered.map((r) => ({
        registration_id: r.id,
        student: r.student?.full_name || '',
        email: r.student?.email || '',
        event: r.eventTitle || r.eventId,
        organizer: r.organizerName || '',
        status: r.status,
        payment_status: r.paymentStatus,
        fee: r.feeAmount,
        deposit: r.depositAmount,
        total: r.amountTotal,
        stripe_session: r.stripeCheckoutSessionId || '',
        stripe_payment_intent: r.stripePaymentIntentId || '',
        paid_at: r.paidAt || '',
        deposit_refunded_at: r.depositRefundedAt || '',
      })),
    )
    setToast?.(error ? error.message : 'Bookings CSV downloaded')
  }

  const exportLedger = () => {
    const { error } = downloadCsv(
      'eventsphere-payments-ledger.csv',
      (ledger || []).map((p) => ({
        id: p.id,
        kind: p.kind,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        stripe_id: p.stripe_id || '',
        event: p.events?.title || p.event_id,
        student: p.profiles?.full_name || p.student_id,
        email: p.profiles?.email || '',
        created_at: p.created_at,
      })),
    )
    setToast?.(error ? error.message : 'Ledger CSV downloaded')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Stripe sandbox</div>
          <h1>Payment management</h1>
          <p>
            Confirm stuck checkouts, refund deposits or full charges, forfeit no-shows, and audit the
            payment ledger — all via live Stripe Edge Functions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={() => load()} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => (tab === 'ledger' ? exportLedger() : exportBookings())}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Collected (paid seats)</div>
          <div className="fact-value">{money(stats.collected)}</div>
        </div>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Payment pending</div>
          <div className="fact-value">{stats.pending}</div>
        </div>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Refunded / partial</div>
          <div className="fact-value">{stats.refunded}</div>
        </div>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Ledger entries</div>
          <div className="fact-value">{stats.ledgerCount}</div>
        </div>
      </div>

      <div className="surface" style={{ padding: 14, marginBottom: 16 }}>
        <div className="toolbar">
          <div className="chips">
            <button
              type="button"
              className={`chip ${tab === 'bookings' ? 'active' : ''}`}
              onClick={() => setTab('bookings')}
            >
              Priced bookings
            </button>
            <button
              type="button"
              className={`chip ${tab === 'ledger' ? 'active' : ''}`}
              onClick={() => setTab('ledger')}
            >
              Stripe ledger
            </button>
          </div>
          {tab === 'bookings' && (
            <>
              <div className="search">
                <input
                  className="input"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search student, event, Stripe id…"
                  aria-label="Search payments"
                />
              </div>
              <select
                className="input"
                style={{ width: 180 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter payment status"
              >
                {STATUS_FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                className="input"
                style={{ width: 200 }}
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                aria-label="Filter event"
              >
                <option value="all">All events</option>
                {pricedEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {loading && <p className="muted">Loading Stripe payment data…</p>}

      {!loading && tab === 'bookings' && (
        <>
          {!filtered.length && (
            <div className="surface" style={{ padding: 24 }}>
              <p className="muted" style={{ margin: 0 }}>
                No priced registrations match these filters.
              </p>
            </div>
          )}
          <div className="surface table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Event</th>
                  <th>Amounts</th>
                  <th>Status</th>
                  <th>Stripe</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const busy = busyKey === r.id
                  const canConfirm =
                    r.paymentStatus === PAYMENT_STATUS.PENDING ||
                    r.paymentStatus === PAYMENT_STATUS.EXPIRED
                  const canDeposit =
                    r.paymentStatus === PAYMENT_STATUS.PAID &&
                    Number(r.depositAmount) > 0 &&
                    !r.depositRefundId
                  const canFull =
                    r.paymentStatus === PAYMENT_STATUS.PAID ||
                    r.paymentStatus === PAYMENT_STATUS.PARTIALLY_REFUNDED
                  const canForfeit =
                    r.paymentStatus === PAYMENT_STATUS.PAID &&
                    Number(r.depositAmount) > 0 &&
                    !r.depositRefundId

                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.student?.full_name || 'Student'}</strong>
                        <br />
                        <span className="subtle">{r.student?.email}</span>
                      </td>
                      <td>
                        {r.eventTitle || r.eventId}
                        <br />
                        <span className="subtle">{r.organizerName || '—'}</span>
                      </td>
                      <td>
                        Fee {money(r.feeAmount)}
                        <br />
                        Dep {money(r.depositAmount)}
                        <br />
                        <strong>{money(r.amountTotal)}</strong>
                      </td>
                      <td data-testid={`admin-payment-status-${r.id}`}>
                        {PAYMENT_STATUS_LABEL[r.paymentStatus] || r.paymentStatus}
                        <br />
                        <span className="subtle">{r.status}</span>
                      </td>
                      <td>
                        <span className="subtle" title={r.stripeCheckoutSessionId || ''}>
                          {(r.stripeCheckoutSessionId || '—').slice(0, 18)}
                          {r.stripeCheckoutSessionId ? '…' : ''}
                        </span>
                        <br />
                        <span className="subtle" title={r.stripePaymentIntentId || ''}>
                          {(r.stripePaymentIntentId || '—').slice(0, 18)}
                          {r.stripePaymentIntentId ? '…' : ''}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 280 }}>
                          {canConfirm && (
                            <button
                              className="btn btn-primary"
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  r.id,
                                  () =>
                                    confirmCheckoutSession({
                                      registrationId: r.id,
                                      eventId: r.eventId,
                                      sessionId: r.stripeCheckoutSessionId || undefined,
                                    }),
                                  'Payment confirmed via Stripe',
                                )
                              }
                            >
                              {busy ? '…' : 'Confirm'}
                            </button>
                          )}
                          {canDeposit && (
                            <button
                              className="btn"
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (!confirm('Refund security deposit via Stripe?')) return
                                runAction(
                                  r.id,
                                  () =>
                                    processRegistrationPayment({
                                      registrationId: r.id,
                                      eventId: r.eventId,
                                      kind: 'deposit',
                                    }),
                                  'Deposit refunded on Stripe',
                                )
                              }}
                            >
                              Refund deposit
                            </button>
                          )}
                          {canFull && (
                            <button
                              className="btn btn-danger"
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  !confirm(
                                    'Full Stripe refund (fee + remaining deposit)? This cannot be undone in sandbox without a new charge.',
                                  )
                                ) {
                                  return
                                }
                                runAction(
                                  r.id,
                                  () =>
                                    processRegistrationPayment({
                                      registrationId: r.id,
                                      eventId: r.eventId,
                                      kind: 'full',
                                    }),
                                  'Full refund issued on Stripe',
                                )
                              }}
                            >
                              Full refund
                            </button>
                          )}
                          {canForfeit && (
                            <button
                              className="btn"
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (!confirm('Mark deposit forfeited (no Stripe refund)?')) return
                                runAction(
                                  r.id,
                                  () =>
                                    processRegistrationPayment({
                                      registrationId: r.id,
                                      eventId: r.eventId,
                                      kind: 'forfeit',
                                    }),
                                  'Deposit marked forfeited',
                                )
                              }}
                            >
                              Forfeit
                            </button>
                          )}
                          {!canConfirm && !canDeposit && !canFull && !canForfeit && (
                            <span className="subtle">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {eventFilter !== 'all' && (
            <div className="surface" style={{ padding: 16, marginTop: 16 }}>
              <div className="eyebrow">Event bulk action</div>
              <p className="muted" style={{ fontSize: 13, margin: '8px 0 12px' }}>
                Refund every paid registration for this event (same as cancel-event flow).
              </p>
              <button
                className="btn btn-danger"
                type="button"
                disabled={busyKey === `event-${eventFilter}`}
                onClick={() => {
                  if (!confirm('Stripe full refund for all paid seats on this event?')) return
                  runAction(
                    `event-${eventFilter}`,
                    () => refundEventPayments(eventFilter),
                    'Event-wide Stripe refunds completed',
                  )
                }}
              >
                Refund all paid on this event
              </button>
            </div>
          )}
        </>
      )}

      {!loading && tab === 'ledger' && (
        <>
          {!ledger.length && (
            <div className="surface" style={{ padding: 24 }}>
              <p className="muted" style={{ margin: 0 }}>
                No ledger rows yet. Charges appear after Stripe checkout is finalized.
              </p>
            </div>
          )}
          <div className="surface table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Kind</th>
                  <th>Student</th>
                  <th>Event</th>
                  <th>Amount</th>
                  <th>Stripe id</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(ledger || []).map((p) => (
                  <tr key={p.id}>
                    <td>{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</td>
                    <td>{p.kind}</td>
                    <td>
                      <strong>{p.profiles?.full_name || '—'}</strong>
                      <br />
                      <span className="subtle">{p.profiles?.email}</span>
                    </td>
                    <td>{p.events?.title || p.event_id}</td>
                    <td>{money(p.amount, p.currency)}</td>
                    <td>
                      <span className="subtle" title={p.stripe_id || ''}>
                        {(p.stripe_id || '—').slice(0, 22)}
                        {p.stripe_id && p.stripe_id.length > 22 ? '…' : ''}
                      </span>
                    </td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
