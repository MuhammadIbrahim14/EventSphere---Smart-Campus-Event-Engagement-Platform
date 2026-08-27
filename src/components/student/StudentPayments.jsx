import { useEffect, useState } from 'react'
import { CreditCard, RefreshCw } from 'lucide-react'
import { listMyPayments } from '@/services/studentExperience'
import { listMyRegistrations } from '@/services/registrations'
import { useAuth } from '@/context/AuthContext'
import { PAYMENT_STATUS_LABEL } from '@/constants/domain'

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

export default function StudentPayments({ setToast, go, events = [] }) {
  const { user } = useAuth()
  const [ledger, setLedger] = useState([])
  const [regs, setRegs] = useState([])
  const [loading, setLoading] = useState(true)

  const titleFor = (eventId) =>
    (events || []).find((e) => String(e.id) === String(eventId))?.title || eventId

  async function load() {
    setLoading(true)
    const [payRes, regRes] = await Promise.all([
      listMyPayments(),
      user?.id ? listMyRegistrations(user.id) : Promise.resolve({ data: [], error: null }),
    ])
    if (payRes.error) setToast?.(payRes.error.message)
    if (regRes.error) setToast?.(regRes.error.message)
    setLedger(payRes.data || [])
    setRegs(regRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const pricedRegs = (regs || []).filter(
    (r) => r.paymentStatus && r.paymentStatus !== 'not_required',
  )

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Wallet & fees</div>
          <h1>My payments</h1>
          <p>
            Your Stripe sandbox charges, deposit refunds, and registration payment status — read-only
            history for this account.
          </p>
        </div>
        <button className="btn" type="button" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Ledger rows</div>
          <div className="fact-value">{ledger.length}</div>
        </div>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Priced registrations</div>
          <div className="fact-value">{pricedRegs.length}</div>
        </div>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Paid seats</div>
          <div className="fact-value">
            {pricedRegs.filter((r) => r.paymentStatus === 'paid' || r.paymentStatus === 'partially_refunded').length}
          </div>
        </div>
      </div>

      <div className="surface" style={{ padding: 16, marginBottom: 16 }}>
        <div className="eyebrow">Registrations · payment status</div>
        {loading && <p className="muted">Loading…</p>}
        {!loading && !pricedRegs.length && (
          <p className="muted" style={{ marginBottom: 0 }}>No priced registrations yet.</p>
        )}
        {!!pricedRegs.length && (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pricedRegs.map((r) => (
                  <tr key={r.id}>
                    <td>{titleFor(r.eventId)}</td>
                    <td>{r.status}</td>
                    <td>{PAYMENT_STATUS_LABEL[r.paymentStatus] || r.paymentStatus}</td>
                    <td>{money(r.amountTotal)}</td>
                    <td>
                      <button className="btn btn-quiet" type="button" onClick={() => go?.(`/student/event/${r.eventId}`)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="surface table-wrap">
        <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CreditCard size={16} />
          <strong>Stripe ledger</strong>
        </div>
        {!loading && !ledger.length && (
          <p className="muted" style={{ padding: '0 16px 16px' }}>
            No charge/refund rows yet. Complete a paid checkout to see history here.
          </p>
        )}
        {!!ledger.length && (
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Kind</th>
                <th>Amount</th>
                <th>Stripe</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((p) => (
                <tr key={p.id}>
                  <td>{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</td>
                  <td>{p.events?.title || p.event_id}</td>
                  <td>{p.kind}</td>
                  <td>{money(p.amount, p.currency)}</td>
                  <td>
                    <span className="subtle" title={p.stripe_id || ''}>
                      {(p.stripe_id || '—').slice(0, 18)}
                      {p.stripe_id && p.stripe_id.length > 18 ? '…' : ''}
                    </span>
                  </td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
