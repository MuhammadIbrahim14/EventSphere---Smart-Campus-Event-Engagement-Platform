import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { EVENT_CATEGORIES, TABLES } from '@/constants/domain'
import { createCategory, deleteCategory, listCategories, updateCategory } from '@/services/categories'
import { useRealtimeTables } from '@/hooks/useRealtimeTables'
import EsModal from '@/components/shared/EsModal'
import { useConfirmDialog } from '@/hooks/useConfirmDialog.jsx'

export default function CategoriesManager({ events = [], setToast, canManage = true }) {
  const { user } = useAuth()
  const { confirm, dialog: confirmUi } = useConfirmDialog()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent)
    if (!silent) setLoading(true)
    const { data, error } = await listCategories()
    if (error) {
      const fromEvents = Array.from(new Set((events || []).map((e) => e.category).filter(Boolean)))
      setRows(
        [...new Set([...EVENT_CATEGORIES, ...fromEvents])].map((n) => ({ id: n, name: n, _local: true })),
      )
      if (!silent) setToast?.(error.message + ' — run supabase/eventsphere-categories.sql')
    } else {
      setRows(data || [])
    }
    if (!silent) setLoading(false)
  }, [events, setToast])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeTables([TABLES.EVENT_CATEGORIES], () => load({ silent: true }), {
    channelName: 'es-categories',
  })

  function openCreate() {
    setEditing(null)
    setName('')
    setOpen(true)
  }

  function openEdit(row) {
    if (row._local) {
      setToast?.('Local/default category — run eventsphere-categories.sql to manage permanently')
      return
    }
    setEditing(row)
    setName(row.name || '')
    setOpen(true)
  }

  function closeForm() {
    setOpen(false)
    setEditing(null)
    setName('')
  }

  async function save() {
    const nextName = name.trim()
    if (!nextName) {
      setToast?.('Category name is required')
      return
    }
    const isEdit = Boolean(editing && !editing._local)
    const editId = editing?.id
    setBusy(true)
    const { data, error } = isEdit
      ? await updateCategory(editId, nextName)
      : await createCategory(nextName, user?.id)
    setBusy(false)
    if (error) {
      setToast?.(error.message)
      return
    }
    if (isEdit && data?.name) {
      setRows((prev) => prev.map((r) => (r.id === editId ? { ...r, name: data.name } : r)))
    }
    closeForm()
    setToast?.(isEdit ? 'Category updated' : 'Category added')
    load()
  }

  async function remove(row) {
    if (row._local) {
      setToast?.('Default/local category — create DB table to manage permanently')
      return
    }
    const ok = await confirm({
      title: 'Delete category?',
      message: `"${row.name}" will be removed from the taxonomy.`,
      confirmLabel: 'Delete category',
      tone: 'danger',
    })
    if (!ok) return
    const { error } = await deleteCategory(row.id)
    if (error) setToast?.(error.message)
    else {
      setToast?.('Category deleted')
      load()
    }
  }

  return (
    <>
      {confirmUi}
      <div className="page-head">
        <div>
          <div className="eyebrow">Taxonomy</div>
          <h1>Categories</h1>
          <p>Live categories from the database. Used when creating events.</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" type="button" onClick={openCreate} data-testid="button-add-category">
            <Plus size={15} /> Add category
          </button>
        )}
      </div>
      {loading && <p className="muted">Loading categories…</p>}
      {!loading && !rows.length && (
        <div className="surface" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>No categories yet. Add one to get started.</p>
        </div>
      )}
      <div className="grid-4 stagger">
        {rows.map((c, i) => (
          <div className="surface" style={{ padding: 17 }} key={c.id || c.name}>
            <div className="section-title">
              <span
                className="avatar"
                style={{
                  background: i % 2 ? 'rgba(229,121,210,.18)' : 'rgba(84,216,232,.18)',
                  color: i % 2 ? 'var(--pink)' : 'var(--cyan)',
                }}
              >
                {(c.name || '?')[0]}
              </span>
              {canManage && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-quiet" type="button" onClick={() => openEdit(c)} aria-label="Edit category" data-testid={`button-edit-category-${c.id}`}>
                    <Pencil size={14} />
                  </button>
                  {!c._local && (
                    <button className="btn btn-quiet btn-danger" type="button" onClick={() => remove(c)} aria-label="Delete category" data-testid={`button-delete-category-${c.id}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
            <h3 className="display" style={{ margin: '15px 0 4px' }}>{c.name}</h3>
            <span className="muted" style={{ fontSize: 11 }}>
              {(events || []).filter((e) => e.category === c.name).length} events
            </span>
          </div>
        ))}
      </div>

      {open && (
        <EsModal title={editing ? 'Edit category' : 'Add category'} onClose={closeForm}>
          <label className="label">Category name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Community"
            data-testid="input-category-name"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button className="btn" type="button" style={{ flex: 1 }} onClick={closeForm}>
              Cancel
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} type="button" disabled={busy} onClick={save} data-testid="button-save-category">
              {busy ? 'Saving…' : editing ? 'Update category' : 'Save category'}
            </button>
          </div>
        </EsModal>
      )}
    </>
  )
}
