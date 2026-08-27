import { useMemo, useState } from 'react'
import { Mail, MessageSquareText, Search, Send } from 'lucide-react'
import PublicShell from './PublicShell'
import {
  lookupContactMessages,
  submitContactMessage,
} from '@/services/contact'

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return String(iso)
  }
}

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const [trackEmail, setTrackEmail] = useState('')
  const [trackBusy, setTrackBusy] = useState(false)
  const [trackError, setTrackError] = useState('')
  const [tracked, setTracked] = useState([])

  const repliedCount = useMemo(
    () => tracked.filter((m) => m.admin_reply).length,
    [tracked],
  )

  async function submit(e) {
    e.preventDefault()
    setError('')
    setOkMsg('')
    setBusy(true)
    const { data, error: err } = await submitContactMessage(form)
    setBusy(false)
    if (err) {
      setError(err.message || 'Could not send message')
      return
    }
    setOkMsg('Message saved. Campus admin will reply here and by email.')
    setTrackEmail(form.email)
    setForm({ name: '', email: form.email, subject: '', message: '' })
    if (data?.id) {
      setTracked((prev) => [data, ...prev.filter((m) => m.id !== data.id)])
    }
  }

  async function track(e) {
    e.preventDefault()
    setTrackError('')
    setTrackBusy(true)
    const { data, error: err } = await lookupContactMessages(trackEmail)
    setTrackBusy(false)
    if (err) {
      setTrackError(err.message || 'Could not load messages')
      setTracked([])
      return
    }
    setTracked(data || [])
    if (!(data || []).length) {
      setTrackError('No messages found for this email yet.')
    }
  }

  return (
    <PublicShell eyebrow="Reach the team" title="Contact Us">
      <div className="es-contact-layout">
        <form className="surface es-contact-panel" onSubmit={submit}>
          <div className="eyebrow">Send a message</div>
          <h2 className="display" style={{ margin: '10px 0 8px', fontSize: 22 }}>
            Talk to EventSphere
          </h2>
          <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Anyone can write in — no login required. Your message is stored for campus admin reply.
          </p>

          <div className="form-grid">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="input-contact-name"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                data-testid="input-contact-email"
              />
            </div>
            <div className="full">
              <label className="label">Subject</label>
              <input
                className="input"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="General inquiry"
                data-testid="input-contact-subject"
              />
            </div>
            <div className="full">
              <label className="label">Message</label>
              <textarea
                className="input"
                rows={5}
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                data-testid="input-contact-message"
              />
            </div>
          </div>

          {error ? (
            <p className="muted" style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>
              {error}
            </p>
          ) : null}
          {okMsg ? (
            <p className="muted" style={{ marginTop: 12, fontSize: 12, color: 'var(--lime, #7dffb3)' }}>
              {okMsg}
            </p>
          ) : null}

          <button
            className="btn btn-primary"
            style={{ marginTop: 18 }}
            type="submit"
            disabled={busy}
            data-testid="button-contact-send"
          >
            <Send size={14} /> {busy ? 'Sending…' : 'Send message'}
          </button>
        </form>

        <section className="surface es-contact-panel">
          <div className="eyebrow">Track reply</div>
          <h2 className="display" style={{ margin: '10px 0 8px', fontSize: 22 }}>
            Check your inbox thread
          </h2>
          <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Enter the same email you used. Admin replies appear here — and also land in your email.
          </p>

          <form className="es-contact-track" onSubmit={track}>
            <input
              className="input"
              type="email"
              required
              value={trackEmail}
              onChange={(e) => setTrackEmail(e.target.value)}
              placeholder="you@email.com"
              data-testid="input-contact-track-email"
            />
            <button className="btn" type="submit" disabled={trackBusy} data-testid="button-contact-track">
              <Search size={14} /> {trackBusy ? 'Looking…' : 'Find'}
            </button>
          </form>

          {trackError ? (
            <p className="muted" style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>
              {trackError}
            </p>
          ) : null}

          {tracked.length > 0 ? (
            <div className="es-contact-threads">
              <p className="subtle" style={{ fontSize: 11, marginBottom: 10 }}>
                {tracked.length} message{tracked.length === 1 ? '' : 's'}
                {repliedCount ? ` · ${repliedCount} with admin reply` : ''}
              </p>
              {tracked.map((m) => (
                <article key={m.id} className="es-contact-thread" data-testid={`contact-thread-${m.id}`}>
                  <header>
                    <strong>{m.subject || 'General inquiry'}</strong>
                    <span className={`badge ${m.status === 'replied' ? 'badge-approved' : 'badge-pending'}`}>
                      {m.status}
                    </span>
                  </header>
                  <p className="muted" style={{ fontSize: 11, margin: '6px 0 10px' }}>
                    Sent {formatWhen(m.created_at)}
                  </p>
                  <div className="es-contact-bubble es-contact-bubble--you">
                    <div className="subtle" style={{ fontSize: 10, marginBottom: 4 }}>
                      <Mail size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                      You
                    </div>
                    {m.message}
                  </div>
                  {m.admin_reply ? (
                    <div className="es-contact-bubble es-contact-bubble--admin">
                      <div className="subtle" style={{ fontSize: 10, marginBottom: 4 }}>
                        <MessageSquareText size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                        Admin reply · {formatWhen(m.replied_at)}
                      </div>
                      {m.admin_reply}
                    </div>
                  ) : (
                    <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                      Waiting for campus admin reply…
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </PublicShell>
  )
}
