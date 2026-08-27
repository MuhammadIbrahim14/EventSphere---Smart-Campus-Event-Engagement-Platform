/**
 * Admin — edit public About page (singleton).
 */
import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { EsPageChrome } from '@/components/design-system'
import { TABLES } from '@/constants/domain'
import { useRealtimeTables } from '@/hooks/useRealtimeTables'
import { DEFAULT_ABOUT, getAboutContent, saveAboutContent } from '@/services/siteContent'

export default function AdminAboutEditor({ setToast }) {
  const [form, setForm] = useState({
    eyebrow: DEFAULT_ABOUT.eyebrow,
    title: DEFAULT_ABOUT.title,
    lead: DEFAULT_ABOUT.lead,
    body: DEFAULT_ABOUT.body,
    highlights: DEFAULT_ABOUT.highlights.map((h) => ({ ...h })),
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error, fallback } = await getAboutContent()
    if (error && !fallback) setToast?.(error.message)
    if (data) {
      setForm({
        eyebrow: data.eyebrow,
        title: data.title,
        lead: data.lead,
        body: data.body,
        highlights: (data.highlights || []).map((h) => ({ title: h.title || '', body: h.body || '' })),
      })
    }
    setLoading(false)
  }, [setToast])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeTables([TABLES.SITE_ABOUT], () => load(), { channelName: 'es-admin-about' })

  const updateHighlight = (idx, key, value) => {
    setForm((f) => {
      const highlights = f.highlights.map((h, i) => (i === idx ? { ...h, [key]: value } : h))
      return { ...f, highlights }
    })
  }

  const addHighlight = () => {
    setForm((f) => ({
      ...f,
      highlights: [...f.highlights, { title: '', body: '' }],
    }))
  }

  const removeHighlight = (idx) => {
    setForm((f) => ({
      ...f,
      highlights: f.highlights.filter((_, i) => i !== idx),
    }))
  }

  async function save() {
    setBusy(true)
    const { error } = await saveAboutContent(form)
    setBusy(false)
    if (error) {
      setToast?.(
        /does not exist|schema cache|site_about/i.test(error.message || '')
          ? 'Run supabase/eventsphere-site-content.sql first'
          : error.message,
      )
      return
    }
    setToast?.('About page saved — live on /about')
    load()
  }

  return (
    <div data-testid="admin-about-editor">
      <EsPageChrome
        eyebrow="Public CMS"
        title="About page"
        description="Edit the guest About story. Changes publish instantly to /about."
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={load} disabled={loading || busy}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn btn-primary" type="button" onClick={save} disabled={busy || loading} data-testid="button-save-about">
              <Save size={14} /> {busy ? 'Saving…' : 'Save About'}
            </button>
          </div>
        }
      />

      {loading ? (
        <p className="muted">Loading About content…</p>
      ) : (
        <div className="surface" style={{ padding: 22 }}>
          <div className="form-grid">
            <div>
              <label className="label">Eyebrow</label>
              <input
                className="input"
                value={form.eyebrow}
                onChange={(e) => setForm({ ...form, eyebrow: e.target.value })}
                data-testid="input-about-eyebrow"
              />
            </div>
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                data-testid="input-about-title"
              />
            </div>
            <div className="full">
              <label className="label">Lead (hero line)</label>
              <textarea
                className="input"
                rows={3}
                value={form.lead}
                onChange={(e) => setForm({ ...form, lead: e.target.value })}
                data-testid="input-about-lead"
              />
            </div>
            <div className="full">
              <label className="label">Body (separate paragraphs with a blank line)</label>
              <textarea
                className="input"
                rows={8}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                data-testid="input-about-body"
              />
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="section-title">
              <h2 style={{ margin: 0 }}>Highlight cards</h2>
              <button className="btn btn-quiet" type="button" onClick={addHighlight}>
                <Plus size={14} /> Add card
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              {form.highlights.map((h, idx) => (
                <div key={idx} className="surface" style={{ padding: 14, background: 'var(--overlay-soft)' }}>
                  <div className="form-grid">
                    <div>
                      <label className="label">Card title</label>
                      <input
                        className="input"
                        value={h.title}
                        onChange={(e) => updateHighlight(idx, 'title', e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                      <button className="btn btn-quiet" type="button" onClick={() => removeHighlight(idx)} aria-label="Remove card">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="full">
                      <label className="label">Card body</label>
                      <textarea
                        className="input"
                        rows={2}
                        value={h.body}
                        onChange={(e) => updateHighlight(idx, 'body', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {!form.highlights.length ? (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  No highlight cards yet.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
