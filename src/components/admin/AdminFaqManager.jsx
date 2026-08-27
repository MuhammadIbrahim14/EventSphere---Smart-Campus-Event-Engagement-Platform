import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { EsPageChrome } from '@/components/design-system'
import EsModal from '@/components/shared/EsModal'
import { TABLES } from '@/constants/domain'
import { useConfirmDialog } from '@/hooks/useConfirmDialog.jsx'
import { useRealtimeTables } from '@/hooks/useRealtimeTables'
import {
  createFaq,
  deleteFaq,
  listAllFaqs,
  updateFaq,
} from '@/services/siteContent'

const emptyForm = { question: '', answer: '', sortOrder: 100, published: true }

export default function AdminFaqManager({ setToast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const { confirm, dialog: confirmUi } = useConfirmDialog()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await listAllFaqs()
    if (error) {
      setToast?.(
        /does not exist|schema cache|site_faqs/i.test(error.message || '')
          ? 'Run supabase/eventsphere-site-content.sql first'
          : error.message,
      )
    }
    setRows(data || [])
    setLoading(false)
  }, [setToast])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeTables([TABLES.SITE_FAQS], () => load(), { channelName: 'es-admin-faqs' })

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, sortOrder: (rows.length + 1) * 10 })
    setOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      question: row.question,
      answer: row.answer,
      sortOrder: row.sortOrder,
      published: row.published,
    })
    setOpen(true)
  }

  async function save() {
    if (!form.question.trim() || !form.answer.trim()) {
      setToast?.('Question and answer are required')
      return
    }
    setBusy(true)
    const payload = {
      question: form.question,
      answer: form.answer,
      sortOrder: Number(form.sortOrder) || 0,
      published: form.published,
    }
    const { error } = editing
      ? await updateFaq(editing.id, payload)
      : await createFaq(payload)
    setBusy(false)
    if (error) {
      setToast?.(error.message)
      return
    }
    setToast?.(editing ? 'FAQ updated' : 'FAQ added')
    setOpen(false)
    load()
  }

  async function remove(row) {
    const ok = await confirm({
      title: 'Delete FAQ?',
      message: `"${row.question}" will be removed from the public FAQ page.`,
      confirmLabel: 'Delete FAQ',
      tone: 'danger',
    })
    if (!ok) return
    const { error } = await deleteFaq(row.id)
    if (error) setToast?.(error.message)
    else {
      setToast?.('FAQ deleted')
      load()
    }
  }

  async function togglePublished(row) {
    const { error } = await updateFaq(row.id, { published: !row.published })
    if (error) setToast?.(error.message)
    else load()
  }

  return (
    <div data-testid="admin-faq-manager">
      {confirmUi}
      <EsPageChrome
        eyebrow="Public CMS"
        title="FAQs"
        description="Manage accordion answers on /faq. Unpublished items stay hidden from guests."
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={load} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn btn-primary" type="button" onClick={openCreate} data-testid="button-add-faq">
              <Plus size={14} /> Add FAQ
            </button>
          </div>
        }
      />

      {loading ? (
        <p className="muted">Loading FAQs…</p>
      ) : !rows.length ? (
        <div className="surface" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>
            No FAQs yet. Add one, or run <code>eventsphere-site-content.sql</code> to seed defaults.
          </p>
        </div>
      ) : (
        <div className="surface table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Question</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.sortOrder}</td>
                  <td>
                    <strong>{r.question}</strong>
                    <br />
                    <span className="subtle" style={{ whiteSpace: 'normal' }}>
                      {r.answer.length > 120 ? `${r.answer.slice(0, 120)}…` : r.answer}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`chip ${r.published ? 'active' : ''}`}
                      onClick={() => togglePublished(r)}
                    >
                      {r.published ? 'Published' : 'Hidden'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-quiet" type="button" onClick={() => openEdit(r)} aria-label="Edit FAQ">
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-quiet" type="button" onClick={() => remove(r)} aria-label="Delete FAQ">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <EsModal title={editing ? 'Edit FAQ' : 'Add FAQ'} onClose={() => !busy && setOpen(false)}>
          <div className="form-grid">
            <div className="full">
              <label className="label">Question</label>
              <input
                className="input"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                data-testid="input-faq-question"
              />
            </div>
            <div className="full">
              <label className="label">Answer</label>
              <textarea
                className="input"
                rows={5}
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                data-testid="input-faq-answer"
              />
            </div>
            <div>
              <label className="label">Sort order</label>
              <input
                className="input"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Visibility</label>
              <select
                className="input"
                value={form.published ? 'yes' : 'no'}
                onChange={(e) => setForm({ ...form, published: e.target.value === 'yes' })}
              >
                <option value="yes">Published</option>
                <option value="no">Hidden</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn" type="button" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={save} data-testid="button-save-faq">
              {busy ? 'Saving…' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </EsModal>
      ) : null}
    </div>
  )
}
