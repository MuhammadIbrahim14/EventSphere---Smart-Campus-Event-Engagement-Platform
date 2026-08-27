import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, RefreshCw, Wallet } from 'lucide-react'
import EsModal from '@/components/shared/EsModal'
import { SETTLEMENT_STATUS, TABLES } from '@/constants/domain'
import { useConfirmDialog } from '@/hooks/useConfirmDialog.jsx'
import { useRealtimeTables } from '@/hooks/useRealtimeTables'
import { formatMoney } from '@/lib/eventMappers'
import {
  isEarningsEligible,
  resolveRegistrationSplit,
} from '@/lib/commission'
import {
  cancelOrganizerWithdraw,
  listMyWithdrawRequests,
  requestOrganizerWithdraw,
} from '@/services/withdrawals'

const TABS = [
  { id: 'settled', label: 'Settled details' },
  { id: 'held', label: 'Held (due)' },
  { id: 'withdraw', label: 'Withdraw requests' },
]

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

export default function OrganizerEarningsPanel({
  rows = [],
  events = [],
  setToast,
  onRefreshRegs,
}) {
  const [tab, setTab] = useState('settled')
  const [withdraws, setWithdraws] = useState([])
  const [loadingW, setLoadingW] = useState(true)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const { confirm, dialog: confirmUi } = useConfirmDialog()

  const loadWithdraws = useCallback(async () => {
    setLoadingW(true)
    const { data, error } = await listMyWithdrawRequests()
    if (error) setToast?.(error.message)
    setWithdraws(data || [])
    setLoadingW(false)
  }, [setToast])

  useEffect(() => {
    loadWithdraws()
  }, [loadWithdraws])

  useRealtimeTables(
    [TABLES.ORGANIZER_WITHDRAW_REQUESTS, TABLES.REGISTRATIONS],
    () => {
      loadWithdraws()
      onRefreshRegs?.()
    },
    { channelName: 'es-org-earnings' },
  )

  const eventTitle = (eventId) =>
    events.find((e) => String(e.id) === String(eventId))?.title ||
    rows.find((r) => String(r.eventId) === String(eventId))?.eventTitle ||
    eventId

  const { heldRows, settledRows, earningsHeld, earningsSettled, platformCut } = useMemo(() => {
    const held = []
    const settled = []
    let h = 0
    let s = 0
    let p = 0
    for (const r of rows) {
      if (!isEarningsEligible(r) && r.settlementStatus !== SETTLEMENT_STATUS.SETTLED) continue
      if (r.settlementStatus === SETTLEMENT_STATUS.VOID) continue
      const split = resolveRegistrationSplit(r)
      if (split.fee <= 0 && split.organizerShare <= 0) continue
      p += split.platformFee
      if (r.settlementStatus === SETTLEMENT_STATUS.SETTLED) {
        settled.push({ ...r, split })
        s += split.organizerShare
      } else if (
        r.settlementStatus === SETTLEMENT_STATUS.HELD ||
        (split.organizerShare > 0 && isEarningsEligible(r))
      ) {
        held.push({ ...r, split })
        h += split.organizerShare
      }
    }
    settled.sort((a, b) => String(b.settledAt || '').localeCompare(String(a.settledAt || '')))
    return {
      heldRows: held,
      settledRows: settled,
      earningsHeld: h,
      earningsSettled: s,
      platformCut: p,
    }
  }, [rows])

  const pendingWithdraw = withdraws.find((w) => w.status === 'pending')

  const submitWithdraw = async () => {
    if (earningsHeld <= 0) {
      await confirm({
        title: 'Nothing to withdraw',
        message: 'You have no held earnings yet. After students pay entry fees, your 80% share appears as Held.',
        confirmLabel: 'Got it',
        hideCancel: true,
      })
      return
    }
    setBusy(true)
    const { data, error } = await requestOrganizerWithdraw(note)
    setBusy(false)
    if (error) {
      setToast?.(error.message)
      return
    }
    setWithdrawOpen(false)
    setNote('')
    setToast?.(
      `Demo withdraw requested for ${formatMoney(data?.amount || earningsHeld, 'pkr')}. Waiting for admin approval.`,
    )
    setTab('withdraw')
    await loadWithdraws()
  }

  const cancelPending = async (id) => {
    const ok = await confirm({
      title: 'Cancel withdraw request?',
      message: 'Your held earnings stay available. You can request again later.',
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep pending',
      tone: 'danger',
    })
    if (!ok) return
    const { error } = await cancelOrganizerWithdraw(id)
    if (error) setToast?.(error.message)
    else setToast?.('Withdraw request cancelled')
    await loadWithdraws()
  }

  return (
    <div className="surface es-earnings-panel" data-testid="organizer-earnings" style={{ padding: 18 }}>
      {confirmUi}
      <div className="eyebrow">Earnings & settlement</div>
      <h2 style={{ margin: '6px 0 8px', font: '600 20px var(--font-display)' }}>
        Your organizer share
      </h2>
      <p className="es-earnings-panel__note">
        Platform keeps 20% of each entry fee. Your 80% is <strong>held</strong> until admin settles
        (or approves your demo withdraw). Deposits are not included. This is a campus demo — no real
        bank transfer.
      </p>

      <div className="grid-3" style={{ marginBottom: 8 }}>
        <div>
          <div className="fact-label">Due (held)</div>
          <div className="fact-value">{formatMoney(earningsHeld, 'pkr')}</div>
        </div>
        <div>
          <div className="fact-label">Settled to you</div>
          <div className="fact-value" style={{ color: 'var(--lime)' }}>
            {formatMoney(earningsSettled, 'pkr')}
          </div>
        </div>
        <div>
          <div className="fact-label">Platform cut (info)</div>
          <div className="fact-value">{formatMoney(platformCut, 'pkr')}</div>
        </div>
      </div>

      <div className="es-earnings-panel__actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={Boolean(pendingWithdraw) || earningsHeld <= 0}
          onClick={() => setWithdrawOpen(true)}
          data-testid="button-demo-withdraw"
        >
          <Wallet size={14} /> Demo withdraw
        </button>
        <button type="button" className="btn" onClick={() => { loadWithdraws(); onRefreshRegs?.() }}>
          <RefreshCw size={14} /> Refresh
        </button>
        {pendingWithdraw ? (
          <span className="badge badge-pending">Withdraw pending · {formatMoney(pendingWithdraw.amount, 'pkr')}</span>
        ) : null}
      </div>

      <div className="es-earnings-panel__tabs chips">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settled' && (
        <>
          {!settledRows.length ? (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              No settled payouts yet. When admin marks your share settled (or approves withdraw),
              each booking appears here with student, event, amount, and time.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Settled on</th>
                    <th>Student</th>
                    <th>Event</th>
                    <th>Entry fee</th>
                    <th>Your share (80%)</th>
                    <th>Platform (20%)</th>
                  </tr>
                </thead>
                <tbody>
                  {settledRows.map((r) => (
                    <tr key={r.id} data-testid={`settled-row-${r.id}`}>
                      <td>{formatWhen(r.settledAt)}</td>
                      <td>
                        <strong>{r.student?.full_name || 'Attendee'}</strong>
                        <br />
                        <span className="subtle">{r.student?.email}</span>
                      </td>
                      <td>{eventTitle(r.eventId)}</td>
                      <td>{formatMoney(r.split.fee, 'pkr')}</td>
                      <td>
                        <strong>{formatMoney(r.split.organizerShare, 'pkr')}</strong>
                      </td>
                      <td>{formatMoney(r.split.platformFee, 'pkr')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'held' && (
        <>
          {!heldRows.length ? (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              No held earnings. Paid entry fees on your events will show here until admin settles.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Paid on</th>
                    <th>Student</th>
                    <th>Event</th>
                    <th>Your share</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {heldRows.map((r) => (
                    <tr key={r.id}>
                      <td>{formatWhen(r.paidAt || r.registeredOn)}</td>
                      <td>
                        <strong>{r.student?.full_name || 'Attendee'}</strong>
                        <br />
                        <span className="subtle">{r.student?.email}</span>
                      </td>
                      <td>{eventTitle(r.eventId)}</td>
                      <td>
                        <strong>{formatMoney(r.split.organizerShare, 'pkr')}</strong>
                      </td>
                      <td>
                        <span className="badge badge-pending">Held</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'withdraw' && (
        <>
          {loadingW ? (
            <p className="muted">Loading withdraw history…</p>
          ) : !withdraws.length ? (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              No withdraw requests yet. Use <strong>Demo withdraw</strong> when you have held
              earnings.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Requested</th>
                    <th>Amount</th>
                    <th>Bookings</th>
                    <th>Status</th>
                    <th>Admin note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {withdraws.map((w) => (
                    <tr key={w.id}>
                      <td>{formatWhen(w.createdAt)}</td>
                      <td>
                        <strong>{formatMoney(w.amount, w.currency)}</strong>
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
                        {w.processedAt ? (
                          <>
                            <br />
                            <span className="subtle">{formatWhen(w.processedAt)}</span>
                          </>
                        ) : null}
                      </td>
                      <td>{w.adminNote || w.note || '—'}</td>
                      <td>
                        {w.status === 'pending' ? (
                          <button className="btn btn-quiet" type="button" onClick={() => cancelPending(w.id)}>
                            Cancel
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {withdrawOpen ? (
        <EsModal title="Demo withdraw request" onClose={() => !busy && setWithdrawOpen(false)}>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Request <strong>{formatMoney(earningsHeld, 'pkr')}</strong> from{' '}
            <strong>{heldRows.length}</strong> held booking{heldRows.length === 1 ? '' : 's'}. Admin
            will approve to mark those shares <strong>settled</strong> (offline payout demo — no
            bank API).
          </p>
          <label className="label">Note for admin (optional)</label>
          <textarea
            className="input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Please settle via JazzCash this week"
            data-testid="input-withdraw-note"
          />
          <div className="es-confirm-dialog__actions" style={{ marginTop: 16 }}>
            <button className="btn" type="button" disabled={busy} onClick={() => setWithdrawOpen(false)}>
              Close
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy}
              onClick={submitWithdraw}
              data-testid="button-submit-withdraw"
            >
              <Banknote size={14} /> {busy ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </EsModal>
      ) : null}
    </div>
  )
}
