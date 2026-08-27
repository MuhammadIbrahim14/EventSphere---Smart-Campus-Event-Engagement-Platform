import { useCallback, useEffect, useMemo, useState } from 'react'
import { Mail, RefreshCw, Send } from 'lucide-react'
import { EsPageChrome } from '@/components/design-system'
import { TABLES } from '@/constants/domain'
import { useRealtimeTables } from '@/hooks/useRealtimeTables'
import { sendCampusNotify, isEmailJsNotifyConfigured } from '@/lib/emailjs'
import {
  listAllContactMessages,
  replyToContactMessage,
} from '@/services/contact'

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return String(iso)
  }
}

export default function AdminContactInbox({ setToast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await listAllContactMessages()
    if (error) setToast?.(error.message)
    setRows(data || [])
    setLoading(false)
  }, [setToast])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeTables([TABLES.CONTACT_MESSAGES], () => load(), {
    channelName: 'es-admin-contact',
  })

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    return rows.filter((r) => r.status === filter)
  }, [rows, filter])

  const selected = useMemo(
    () => rows.find((r) => String(r.id) === String(selectedId)) || filtered[0] || null,
    [rows, selectedId, filtered],
  )

  useEffect(() => {
    if (selected && String(selectedId) !== String(selected.id)) {
      setSelectedId(selected.id)
      setDraft(selected.admin_reply || '')
    }
  }, [selected, selectedId])

  const counts = useMemo(() => {
    const open = rows.filter((r) => r.status === 'open').length
    const replied = rows.filter((r) => r.status === 'replied').length
    return { open, replied, all: rows.length }
  }, [rows])

  async function sendReply() {
    if (!selected?.id) return
    const reply = draft.trim()
    if (reply.length < 2) {
      setToast?.('Write a reply first')
      return
    }
    setBusy(true)
    const { data, error } = await replyToContactMessage({ id: selected.id, reply })
    if (error) {
      setBusy(false)
      setToast?.(error.message)
      return
    }

    let mailNote = ''
    if (isEmailJsNotifyConfigured && selected.email) {
      const { error: mailErr } = await sendCampusNotify({
        toEmail: selected.email,
        toName: selected.name || 'there',
        subject: `Re: ${selected.subject || 'Your EventSphere message'}`,
        title: 'EventSphere replied to your message',
        message: [
          `Hi ${selected.name || 'there'},`,
          '',
          'Campus admin replied to your Contact Us message:',
          '',
          reply,
          '',
          `Your original subject: ${selected.subject || 'General inquiry'}`,
          'You can also view this reply on the Contact page → Track reply.',
        ].join('\n'),
      })
      mailNote = mailErr ? ` (email failed: ${mailErr.message})` : ' · email sent'
    } else {
      mailNote = ' · email skipped (notify template not configured)'
    }

    setBusy(false)
    setToast?.(`Reply saved${mailNote}`)
    if (data) {
      setRows((prev) => prev.map((r) => (r.id === data.id ? data : r)))
      setDraft(data.admin_reply || reply)
    } else {
      load()
    }
  }

  return (
    <div className="es-admin-contact" data-testid="admin-contact-inbox">
      <EsPageChrome
        eyebrow="Public inbox"
        title="Contact messages"
        description="Replies save to the database, show on the Contact track panel, and email the sender."
        action={
          <button type="button" className="btn" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'es-org-regs__spin' : ''} />
            Refresh
          </button>
        }
      />

      <div className="es-org-regs__chips" style={{ marginBottom: 14 }}>
        <span className="es-org-regs__chip-label">Status</span>
        {[
          { id: 'open', label: `Open (${counts.open})` },
          { id: 'replied', label: `Replied (${counts.replied})` },
          { id: 'all', label: `All (${counts.all})` },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="es-admin-contact__grid">
        <div className="surface es-admin-contact__list">
          {loading ? <p className="muted" style={{ padding: 16 }}>Loading…</p> : null}
          {!loading && !filtered.length ? (
            <p className="muted" style={{ padding: 16, margin: 0 }}>
              No messages in this filter.
            </p>
          ) : null}
          {filtered.map((m) => {
            const active = selected && String(selected.id) === String(m.id)
            return (
              <button
                key={m.id}
                type="button"
                className={`es-admin-contact__item ${active ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedId(m.id)
                  setDraft(m.admin_reply || '')
                }}
              >
                <div className="es-admin-contact__item-top">
                  <strong>{m.name}</strong>
                  <span className={`badge ${m.status === 'replied' ? 'badge-approved' : 'badge-pending'}`}>
                    {m.status}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{m.email}</div>
                <div className="es-admin-contact__preview">{m.subject || m.message}</div>
                <div className="subtle" style={{ fontSize: 10, marginTop: 6 }}>
                  {formatWhen(m.created_at)}
                </div>
              </button>
            )
          })}
        </div>

        <div className="surface es-admin-contact__detail">
          {!selected ? (
            <p className="muted" style={{ margin: 0 }}>Select a message to reply.</p>
          ) : (
            <>
              <div className="eyebrow">Conversation</div>
              <h2 className="display" style={{ margin: '8px 0 4px', fontSize: 22 }}>
                {selected.subject || 'General inquiry'}
              </h2>
              <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
                <Mail size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
                {selected.name} · {selected.email} · {formatWhen(selected.created_at)}
              </p>

              <div className="es-contact-bubble es-contact-bubble--you">
                <div className="subtle" style={{ fontSize: 10, marginBottom: 4 }}>Visitor</div>
                {selected.message}
              </div>

              {selected.admin_reply ? (
                <div className="es-contact-bubble es-contact-bubble--admin" style={{ marginTop: 12 }}>
                  <div className="subtle" style={{ fontSize: 10, marginBottom: 4 }}>
                    Your reply · {formatWhen(selected.replied_at)}
                  </div>
                  {selected.admin_reply}
                </div>
              ) : null}

              <label className="label" style={{ marginTop: 18 }}>Admin reply</label>
              <textarea
                className="input"
                rows={5}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a clear campus reply…"
                data-testid="input-admin-contact-reply"
              />
              <button
                className="btn btn-primary"
                type="button"
                style={{ marginTop: 12 }}
                disabled={busy}
                onClick={sendReply}
                data-testid="button-admin-contact-reply"
              >
                <Send size={14} /> {busy ? 'Sending…' : selected.admin_reply ? 'Update & email reply' : 'Send reply'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
