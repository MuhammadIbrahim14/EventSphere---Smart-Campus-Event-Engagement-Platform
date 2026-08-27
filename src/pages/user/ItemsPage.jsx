import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  createItem,
  deleteItem,
  getItems,
  updateItem,
} from '../../services/items'
import { useConfirmDialog } from '@/hooks/useConfirmDialog.jsx'

const emptyForm = { title: '', description: '', status: 'active' }

export default function ItemsPage({ scope = 'user' }) {
  const { user } = useAuth()
  const { confirm, dialog: confirmUi } = useConfirmDialog()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: err } = await getItems()
    if (err) setError(err.message)
    else setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function startEdit(item) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      description: item.description || '',
      status: item.status,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    if (editingId) {
      const { error: err } = await updateItem(editingId, {
        title: form.title,
        description: form.description,
        status: form.status,
      })
      if (err) setError(err.message)
      else {
        cancelEdit()
        await load()
      }
    } else {
      const { error: err } = await createItem({
        userId: user.id,
        title: form.title,
        description: form.description,
        status: form.status,
      })
      if (err) setError(err.message)
      else {
        setForm(emptyForm)
        await load()
      }
    }

    setBusy(false)
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: 'Delete item?',
      message: 'This item will be removed permanently.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setError('')
    const { error: err } = await deleteItem(id)
    if (err) setError(err.message)
    else await load()
  }

  return (
    <div className="page">
      {confirmUi}
      <header className="page-header">
        <h1>{scope === 'admin' ? 'All items' : 'My items'}</h1>
        <p className="muted">
          CRUD check — GET list, POST create, PUT update, DELETE remove
        </p>
      </header>

      <form className="crud-form" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Update item (PUT)' : 'Create item (POST)'}</h2>
        <div className="form-grid">
          <label>
            Title
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </label>
          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="active">active</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <label className="full">
            Description
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && <p className="form-error">{error}</p>}

      <section className="table-wrap">
        <h2>Items (GET)</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="muted">No items yet. Create one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                {scope === 'admin' && <th>Owner</th>}
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    {item.description && (
                      <span className="row-desc">{item.description}</span>
                    )}
                  </td>
                  <td>
                    <span className={`pill status-${item.status}`}>{item.status}</span>
                  </td>
                  {scope === 'admin' && (
                    <td className="mono">{item.user_id.slice(0, 8)}…</td>
                  )}
                  <td>{new Date(item.updated_at).toLocaleString()}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => startEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
