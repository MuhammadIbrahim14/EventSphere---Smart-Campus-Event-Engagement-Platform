import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import {
  DEFAULT_PLATFORM_COMMISSION_PCT,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABEL,
  TABLES,
} from '@/constants/domain'
import { downloadCsv } from '@/lib/csvExport'
import { listAllRegistrations } from '@/services/registrations'
import {
  confirmCheckoutSession,
  listAllPayments,
  processRegistrationPayment,
  refundEventPayments,
  settleEventEarnings,
  settleRegistrationEarnings,
} from '@/services/payments'
import {
  listAllWithdrawRequests,
  processOrganizerWithdraw,
} from '@/services/withdrawals'
import {
  SETTLEMENT_STATUS,
  SETTLEMENT_STATUS_LABEL,
  formatSplitLine,
  isEarningsEligible,
  resolveRegistrationSplit,
} from '@/lib/commission'
import { useConfirmDialog } from '@/hooks/useConfirmDialog.jsx'
import { useRealtimeTables } from '@/hooks/useRealtimeTables'

const STATUS_FILTERS = [
  { id: 'all', label: 'All priced' },
  { id: 'pending', label: 'Pending' },
  { id: 'paid', label: 'Paid' },
  { id: 'partially_refunded', label: 'Deposit refunded' },
  { id: 'refunded', label: 'Fully refunded' },
  { id: 'forfeited', label: 'Forfeited' },
  { id: 'expired', label: 'Expired' },
]

function money(n, currency = 'pkr') {
  const v = Number(n || 0)
  const cur = String(currency || 'pkr').toUpperCase()
  try {
    return new Intl.NumberFormat(cur === 'PKR' ? 'en-PK' : 'en-US', {
      style: 'currency',
      currency: cur,
      currencyDisplay: 'code',
      maximumFractionDigits: cur === 'PKR' ? 0 : 2,
      minimumFractionDigits: cur === 'PKR' ? 0 : 2,
    }).format(v)
  } catch {
    return `${cur} ${v.toFixed(cur === 'PKR' ? 0 : 2)}`
  }
}

export default function AdminPayments({ events = [], setToast }) {
  const [tab, setTab] = useState('bookings')
  const [regs, setRegs] = useState([])
  const [ledger, setLedger] = useState([])
  const [withdraws, setWithdraws] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [q, setQ] = useState('')
  const [busyKey, setBusyKey] = useState(null)
  const { confirm, dialog: confirmUi } = useConfirmDialog()

  const load = useCallback(
    async (opts = {}) => {
      const silent = Boolean(opts.silent)
      if (!silent) setLoading(true)
      const [regsRes, payRes, wRes] = await Promise.all([
        listAllRegistrations(),
        listAllPayments(),
        listAllWithdrawRequests(),
      ])
      if (!silent) {
        if (regsRes.error) setToast?.(regsRes.error.message)
        if (payRes.error) setToast?.(payRes.error.message)
        if (wRes.error && !/does not exist|schema cache|organizer_withdraw/i.test(wRes.error.message || '')) {
          setToast?.(wRes.error.message)
        }
      }
      setRegs(regsRes.data || [])
      setLedger(payRes.data || [])
      setWithdraws(wRes.data || [])
      if (!silent) setLoading(false)
    },
    [setToast],
  )

  useEffect(() => {
    load()
  }, [load])

  useRealtimeTables(
    [TABLES.REGISTRATIONS, TABLES.EVENT_PAYMENTS, TABLES.PAYMENT_AUDIT_LOG, TABLES.ORGANIZER_WITHDRAW_REQUESTS],
    () => load({ silent: true }),
    { channelName: 'es-admin-payments' },
  )

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

    let platformProfit = 0
    let organizerHeld = 0
    let organizerSettled = 0
    for (const r of pricedRegs) {
      if (!isEarningsEligible(r)) continue
      const split = resolveRegistrationSplit(r)
      if (r.settlementStatus === SETTLEMENT_STATUS.VOID) continue
      platformProfit += split.platformFee
      if (r.settlementStatus === SETTLEMENT_STATUS.SETTLED) organizerSettled += split.organizerShare
      else if (
        r.settlementStatus === SETTLEMENT_STATUS.HELD ||
        (split.organizerShare > 0 && r.settlementStatus !== SETTLEMENT_STATUS.SETTLED)
      ) {
        organizerHeld += split.organizerShare
      }
    }

    return {
      paid: paid.length,
      pending: pending.length,
      refunded: refunded.length,
      forfeited: forfeited.length,
      collected,
      ledgerCount: ledger.length,
      platformProfit,
      organizerHeld,
      organizerSettled,
      commissionPct: DEFAULT_PLATFORM_COMMISSION_PCT,
    }
  }, [pricedRegs, ledger])

  const settlementRows = useMemo(() => {
    return pricedRegs
      .filter((r) => {
        const split = resolveRegistrationSplit(r)
        if (split.fee <= 0) return false
        if (!isEarningsEligible(r) && r.settlementStatus !== SETTLEMENT_STATUS.VOID) return false
        if (eventFilter !== 'all' && String(r.eventId) !== String(eventFilter)) return false
        return true
      })
      .sort((a, b) => {
        const order = { held: 0, settled: 1, void: 2, none: 3 }
        return (order[a.settlementStatus] ?? 9) - (order[b.settlementStatus] ?? 9)
      })
  }, [pricedRegs, eventFilter])

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
        platform_fee: r.platformFee,
        organizer_share: r.organizerShare,
        commission_percent: r.commissionPercent,
        settlement_status: r.settlementStatus,
        settled_at: r.settledAt || '',
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
      {confirmUi}
      <div className="page-head">
        <div>
          <div className="eyebrow">Stripe sandbox</div>
          <h1>Payment management</h1>
          <p>
            Stripe sandbox confirm / refunds, plus platform commission ({stats.commissionPct}% of
            entry fee) and organizer settlement (offline payout recorded here — no auto bank
            transfer).
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
          <div className="fact-label">Platform profit ({stats.commissionPct}%)</div>
          <div className="fact-value">{money(stats.platformProfit)}</div>
        </div>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Organizer due (held)</div>
          <div className="fact-value">{money(stats.organizerHeld)}</div>
        </div>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Organizer settled</div>
          <div className="fact-value">{money(stats.organizerSettled)}</div>
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
              className={`chip ${tab === 'settlement' ? 'active' : ''}`}
              onClick={() => setTab('settlement')}
            >
              Commission & settlement
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
          {tab === 'settlement' && (
            <select
              className="input"
              style={{ width: 220 }}
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              aria-label="Filter event settlement"
            >
              <option value="all">All events</option>
              {pricedEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
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
                        {Number(r.feeAmount) > 0 ? (
                          <>
                            <br />
                            <span className="subtle">{formatSplitLine(r, 'pkr')}</span>
                          </>
                        ) : null}
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
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Refund deposit?',
                                  message: 'Refund the security deposit via Stripe sandbox for this booking?',
                                  confirmLabel: 'Refund deposit',
                                  tone: 'danger',
                                })
                                if (!ok) return
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
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Full refund?',
                                  message:
                                    'Issue a full Stripe refund (entry fee + remaining deposit)? This cannot be undone in sandbox without a new charge.',
                                  confirmLabel: 'Full refund',
                                  tone: 'danger',
                                })
                                if (!ok) return
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
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Forfeit deposit?',
                                  message: 'Mark the security deposit as forfeited with no Stripe refund?',
                                  confirmLabel: 'Forfeit deposit',
                                  tone: 'danger',
                                })
                                if (!ok) return
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
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Refund all paid seats?',
                    message: 'Stripe full refund for every paid registration on this event?',
                    confirmLabel: 'Refund all',
                    tone: 'danger',
                  })
                  if (!ok) return
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

      {!loading && tab === 'settlement' && (
        <>
          <div className="surface" style={{ padding: 16, marginBottom: 16 }}>
            <div className="eyebrow">How settlement works</div>
            <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>
              Student pays 100% via Stripe into the platform account. Platform keeps{' '}
              <strong>{stats.commissionPct}%</strong> of the entry fee; organizer is owed the rest.
              Deposit is excluded from this split. After you pay the organizer offline, mark the row
              Settled here.
            </p>
          </div>

          {!settlementRows.length && (
            <div className="surface" style={{ padding: 24 }}>
              <p className="muted" style={{ margin: 0 }}>
                No fee splits yet. Paid bookings with an entry fee appear here after checkout
                finalize (run <code>eventsphere-commission-settlement.sql</code> if columns are
                missing).
              </p>
            </div>
          )}

          {settlementRows.length > 0 && (
            <div className="surface table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Event / organizer</th>
                    <th>Entry fee</th>
                    <th>Platform {stats.commissionPct}%</th>
                    <th>Organizer share</th>
                    <th>Settlement</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {settlementRows.map((r) => {
                    const split = resolveRegistrationSplit(r)
                    const busy = busyKey === `settle-${r.id}`
                    const canSettle =
                      r.settlementStatus === SETTLEMENT_STATUS.HELD &&
                      isEarningsEligible(r) &&
                      split.organizerShare > 0
                    const currency = r.event?.currency || 'pkr'

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
                        <td>{money(split.fee, currency)}</td>
                        <td>{money(split.platformFee, currency)}</td>
                        <td>
                          <strong>{money(split.organizerShare, currency)}</strong>
                        </td>
                        <td>
                          {SETTLEMENT_STATUS_LABEL[r.settlementStatus] ||
                            r.settlementStatus ||
                            '—'}
                          {r.settledAt ? (
                            <>
                              <br />
                              <span className="subtle">
                                {new Date(r.settledAt).toLocaleString()}
                              </span>
                            </>
                          ) : null}
                        </td>
                        <td>
                          {canSettle ? (
                            <button
                              className="btn btn-primary"
                              type="button"
                              disabled={busy}
                              data-testid={`button-settle-${r.id}`}
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Mark settled?',
                                  message: `Record ${money(split.organizerShare, currency)} as settled to the organizer (offline payout done)?`,
                                  confirmLabel: 'Mark settled',
                                  tone: 'success',
                                })
                                if (!ok) return
                                runAction(
                                  `settle-${r.id}`,
                                  () => settleRegistrationEarnings(r.id),
                                  'Organizer share marked settled',
                                )
                              }}
                            >
                              {busy ? '…' : 'Mark settled'}
                            </button>
                          ) : (
                            <span className="subtle">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {eventFilter !== 'all' && (
            <div className="surface" style={{ padding: 16, marginTop: 16 }}>
              <div className="eyebrow">Bulk settle event</div>
              <p className="muted" style={{ fontSize: 13, margin: '8px 0 12px' }}>
                Mark every held organizer share for this event as settled (after offline payout).
              </p>
              <button
                className="btn btn-primary"
                type="button"
                disabled={busyKey === `settle-event-${eventFilter}`}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Settle all held shares?',
                    message: 'Mark every held organizer share for this event as settled after offline payout?',
                    confirmLabel: 'Settle all',
                    tone: 'success',
                  })
                  if (!ok) return
                  runAction(
                    `settle-event-${eventFilter}`,
                    () => settleEventEarnings(eventFilter),
                    'Event organizer shares settled',
                  )
                }}
              >
                Settle all held on this event
              </button>
            </div>
          )}

          <div className="surface" style={{ padding: 16, marginTop: 16 }}>
            <div className="eyebrow">Demo withdraw requests</div>
            <p className="muted" style={{ fontSize: 13, margin: '8px 0 12px' }}>
              Organizers request payout of held earnings. Approve settles those bookings and moves
              amounts into their Settled details. Reject leaves earnings held.
            </p>
            {!withdraws.length ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                No withdraw requests yet. (Run <code>eventsphere-organizer-withdraw.sql</code> if
                missing.)
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Organizer</th>
                      <th>Amount</th>
                      <th>Bookings</th>
                      <th>Status</th>
                      <th>Note</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdraws.map((w) => {
                      const busy = busyKey === `wd-${w.id}`
                      return (
                        <tr key={w.id}>
                          <td>{w.createdAt ? new Date(w.createdAt).toLocaleString() : '—'}</td>
                          <td>
                            <strong>{w.organizer?.full_name || 'Organizer'}</strong>
                            <br />
                            <span className="subtle">{w.organizer?.email}</span>
                          </td>
                          <td>
                            <strong>{money(w.amount, w.currency)}</strong>
                          </td>
                          <td>{(w.heldRegistrationIds || []).length}</td>
                          <td>
                            <span
                              className={`badge ${
                                w.status === 'approved'
                                  ? 'badge-approved'
                                  : w.status === 'pending'
                                    ? 'badge-pending'
                                    : 'badge-cancelled'
                              }`}
                            >
                              {w.status}
                            </span>
                          </td>
                          <td style={{ maxWidth: 180 }}>
                            {w.note || '—'}
                            {w.adminNote ? (
                              <>
                                <br />
                                <span className="subtle">Admin: {w.adminNote}</span>
                              </>
                            ) : null}
                          </td>
                          <td>
                            {w.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button
                                  className="btn btn-primary"
                                  type="button"
                                  disabled={busy}
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: 'Approve withdraw?',
                                      message: `Settle ${money(w.amount, w.currency)} to ${w.organizer?.full_name || 'organizer'} and mark those bookings settled?`,
                                      confirmLabel: 'Approve & settle',
                                      tone: 'success',
                                    })
                                    if (!ok) return
                                    runAction(
                                      `wd-${w.id}`,
                                      () => processOrganizerWithdraw(w.id, true, 'Approved (demo)'),
                                      'Withdraw approved — organizer shares settled',
                                    )
                                  }}
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn"
                                  type="button"
                                  disabled={busy}
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: 'Reject withdraw?',
                                      message: 'Earnings stay held. Organizer can request again later.',
                                      confirmLabel: 'Reject',
                                      tone: 'danger',
                                    })
                                    if (!ok) return
                                    runAction(
                                      `wd-${w.id}`,
                                      () => processOrganizerWithdraw(w.id, false, 'Rejected'),
                                      'Withdraw request rejected',
                                    )
                                  }}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="subtle">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
