import { useState } from 'react'
import PublicShell from './PublicShell'

export default function ContactPage() {
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })

  function submit(e) {
    e.preventDefault()
    setSent(true)
  }

  return (
    <PublicShell eyebrow="Reach the team" title="Contact Us">
      <form className="surface" style={{ padding: 24 }} onSubmit={submit}>
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
        <button className="btn btn-primary" style={{ marginTop: 18 }} type="submit" data-testid="button-contact-send">
          {sent ? 'Message noted' : 'Send message'}
        </button>
        {sent && (
          <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
            Thanks — for production demos, wire this form to EmailJS or a campus inbox.
          </p>
        )}
      </form>
    </PublicShell>
  )
}
