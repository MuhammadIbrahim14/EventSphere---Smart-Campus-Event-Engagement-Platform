import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { PAYMENT_STATUS_LABEL } from '@/constants/domain'
import { listAllRegistrations, listEventRegistrations } from '@/services/registrations'

export default function RegistrationsDirectory({ events = [], setToast, scope = 'all' }) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const scopedEvents = useMemo(() => {
    if (scope === 'organizer') {
      const owned = (events || []).filter((e) => e.organizerId === user?.id)
      return owned.length ? owned : events || []
    }
    return events || []
  }, [events, scope, user?.id])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      if (scope === 'all') {
        const { data, error } = await listAllRegistrations()
        if (!alive) return
        if (error) setToast?.(error.message)
        setRows(data || [])
      } else {
        const batches = await Promise.all(
          scopedEvents.map(async (ev) => {
            const { data, error } = await listEventRegistrations(ev.id)
            if (error) return []
            return (data || []).map((r) => ({
              ...r,
              eventTitle: ev.title,
              organizerName: ev.organizer,
            }))
          }),
        )
        if (!alive) return
        setRows(batches.flat())
      }
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [scope, scopedEvents, setToast])

  const paidCount = rows.filter(
    (r) => r.paymentStatus === 'paid' || r.paymentStatus === 'partially_refunded',
  ).length
  const pendingPay = rows.filter((r) => r.paymentStatus === 'pending').length
  const refunded = rows.filter(
    (r) => r.paymentStatus === 'partially_refunded' || r.paymentStatus === 'refunded',
  ).length
  const forfeited = rows.filter((r) => r.paymentStatus === 'forfeited').length

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Operations</div>
          <h1>Registrations</h1>
          <p>Live registration rows from Supabase — including Stripe payment status.</p>
        </div>
      </div>
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Paid</div>
          <div className="fact-value">{paidCount}</div>
        </div>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Payment pending</div>
          <div className="fact-value">{pendingPay}</div>
        </div>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Refunded</div>
          <div className="fact-value">{refunded}</div>
        </div>
        <div className="surface" style={{ padding: 14 }}>
          <div className="fact-label">Forfeited</div>
          <div className="fact-value">{forfeited}</div>
        </div>
      </div>
      {loading && <p className="muted">Loading registrations…</p>}
      {!loading && !rows.length && (
        <div className="surface" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>No registrations yet.</p>
        </div>
      )}
      <div className="surface table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Event</th>
              <th>Organizer</th>
              <th>Registered</th>
              <th>Status</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.student?.full_name || r.studentId || 'Student'}</strong>
                  <br />
                  <span className="subtle">{r.student?.email}</span>
                </td>
                <td>{r.eventTitle || r.event?.title || r.eventId}</td>
                <td>{r.organizerName || r.event?.organizer || '—'}</td>
                <td>{r.registeredOn ? new Date(r.registeredOn).toLocaleString() : '—'}</td>
                <td>{r.status}</td>
                <td data-testid={`payment-status-${r.id}`}>
                  {PAYMENT_STATUS_LABEL[r.paymentStatus] || r.paymentStatus || 'Free'}
                  {Number(r.amountTotal) > 0 ? ` · $${Number(r.amountTotal).toFixed(2)}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
