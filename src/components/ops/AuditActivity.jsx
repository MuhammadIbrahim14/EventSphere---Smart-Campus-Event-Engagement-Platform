import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TABLES } from '@/constants/domain'
import { formatMoney } from '@/lib/eventMappers'
import { listPaymentAudit } from '@/services/paymentAudit'

/** Live audit feed built from real tables (no dummy rows). */
export default function AuditActivity({ setToast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const [events, regs, anns, attendance, payAudit, ledger] = await Promise.all([
        supabase
          .from(TABLES.EVENTS)
          .select('id, title, status, updated_at, organizer_id, profiles:organizer_id(full_name)')
          .order('updated_at', { ascending: false })
          .limit(25),
        supabase
          .from(TABLES.REGISTRATIONS)
          .select('id, status, registered_on, event_id, student_id, payment_status, payment_meta, events:event_id(title), profiles:student_id(full_name)')
          .order('registered_on', { ascending: false })
          .limit(25),
        supabase
          .from(TABLES.ANNOUNCEMENTS)
          .select('id, title, published_at, created_by, profiles:created_by(full_name)')
          .order('published_at', { ascending: false })
          .limit(15),
        supabase
          .from(TABLES.ATTENDANCE)
          .select('id, marked_on, method, event_id, student_id, events:event_id(title), profiles:student_id(full_name)')
          .order('marked_on', { ascending: false })
          .limit(25),
        listPaymentAudit({ limit: 60 }),
        supabase
          .from(TABLES.EVENT_PAYMENTS)
          .select('id, kind, amount, created_at, stripe_id, meta, events:event_id(title), profiles:student_id(full_name)')
          .order('created_at', { ascending: false })
          .limit(40),
      ])

      const items = []
      if (events.error) setToast?.(events.error.message)
      ;(events.data || []).forEach((e) => {
        items.push({
          id: `ev-${e.id}-${e.updated_at}`,
          at: e.updated_at,
          kind: 'Event',
          summary: `${e.title} → ${e.status}`,
          who: e.profiles?.full_name || 'Organizer',
        })
      })
      if (regs.error) setToast?.(regs.error.message)
      ;(regs.data || []).forEach((r) => {
        items.push({
          id: `reg-${r.id}`,
          at: r.registered_on,
          kind: 'Registration',
          summary: `${r.profiles?.full_name || 'Student'} · ${r.events?.title || r.event_id} · ${r.status}${r.payment_status && r.payment_status !== 'not_required' ? ` · pay:${r.payment_status}` : ''}`,
          who: r.profiles?.full_name || 'Student',
        })
      })
      if (anns.error) setToast?.(anns.error.message)
      ;(anns.data || []).forEach((a) => {
        items.push({
          id: `ann-${a.id}`,
          at: a.published_at,
          kind: 'Announcement',
          summary: a.title,
          who: a.profiles?.full_name || 'Staff',
        })
      })
      if (attendance.error) setToast?.(attendance.error.message)
      ;(attendance.data || []).forEach((a) => {
        items.push({
          id: `att-${a.id}`,
          at: a.marked_on,
          kind: 'Attendance',
          summary: `${a.profiles?.full_name || 'Student'} present at ${a.events?.title || a.event_id} (${a.method})`,
          who: a.profiles?.full_name || 'Staff',
        })
      })
      if (payAudit.error) setToast?.(payAudit.error.message)
      ;(payAudit.data || []).forEach((p) => {
        items.push({
          id: `paudit-${p.id}`,
          at: p.created_at,
          kind: 'Payment action',
          summary: `${p.action} · ${p.events?.title || p.event_id || 'event'} · ${p.student?.full_name || p.student_id || 'student'}`,
          who: p.actor?.full_name || p.detail?.actor_email || 'Staff / system',
        })
      })
      if (ledger.error && !/does not exist|schema cache/i.test(ledger.error.message || '')) {
        setToast?.(ledger.error.message)
      }
      ;(ledger.data || []).forEach((p) => {
        const actor =
          p.meta?.confirmed_by ||
          p.meta?.actor_id ||
          p.meta?.refunded_by ||
          null
        items.push({
          id: `pledger-${p.id}`,
          at: p.created_at,
          kind: 'Payment ledger',
          summary: `${p.kind} · ${formatMoney(p.amount || 0, p.currency || 'pkr')} · ${p.events?.title || 'event'} · ${p.profiles?.full_name || 'student'}${p.stripe_id ? ` · ${String(p.stripe_id).slice(0, 14)}…` : ''}`,
          who: actor ? `meta:${String(actor).slice(0, 8)}…` : p.profiles?.full_name || 'Stripe',
        })
      })

      items.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
      if (alive) {
        setRows(items.slice(0, 80))
        setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [setToast])

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Platform trail</div>
          <h1>Audit activity</h1>
          <p>
            Events, registrations, announcements, attendance, Stripe ledger rows, and payment actions
            (confirm / refund / forfeit) with actor when available.
          </p>
        </div>
      </div>
      {loading && <p className="muted">Loading audit feed…</p>}
      {!loading && !rows.length && (
        <div className="surface" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>No activity recorded yet.</p>
        </div>
      )}
      <div className="surface table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Summary</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.at ? new Date(r.at).toLocaleString() : '—'}</td>
                <td>{r.kind}</td>
                <td>{r.summary}</td>
                <td>{r.who}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
