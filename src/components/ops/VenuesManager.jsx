import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { VENUE_AVAILABILITY } from '@/constants/domain'
import { createVenue, deleteVenue, listVenues, updateVenue } from '@/services/venues'
import VenueMapPicker from '@/components/ops/VenueMapPicker'

const emptyForm = {
  name: '',
  location: '',
  capacity: '100',
  availability: VENUE_AVAILABILITY.AVAILABLE,
  latitude: null,
  longitude: null,
  map_place_id: null,
}

function CenterModal({ title, onClose, children }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      style={{ zIndex: 200, alignItems: 'center', justifyItems: 'center' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        style={{ margin: 'auto', width: 'min(560px, calc(100vw - 24px))', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export default function VenuesManager({ events = [], setToast, canManage = true }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    setLoading(true)
    const { data, error } = await listVenues()
    if (error) setToast?.(error.message)
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      name: row.name || '',
      location: row.location || '',
      capacity: String(row.capacity ?? 100),
      availability: row.availability || VENUE_AVAILABILITY.AVAILABLE,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      map_place_id: row.map_place_id ?? null,
    })
    setOpen(true)
  }

  function closeForm() {
    setOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  async function save() {
    if (!form.name.trim()) {
      setToast?.('Venue name is required')
      return
    }
    setBusy(true)
    const payload = {
      name: form.name.trim(),
      location: form.location,
      capacity: form.capacity,
      availability: form.availability,
      latitude: form.latitude,
      longitude: form.longitude,
      map_place_id: form.map_place_id,
    }
    const { error } = editing
      ? await updateVenue(editing.id, payload)
      : await createVenue(payload)
    setBusy(false)
    if (error) {
      setToast?.(error.message)
      return
    }
    closeForm()
    setToast?.(editing ? 'Venue updated' : 'Venue added')
    load()
  }

  async function remove(row) {
    if (!confirm(`Delete venue "${row.name}"?`)) return
    const { error } = await deleteVenue(row.id)
    if (error) setToast?.(error.message)
    else {
      setToast?.('Venue deleted')
      load()
    }
  }

  function scheduledCount(name) {
    return (events || []).filter((e) => e.venue === name).length
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Places & capacity</div>
          <h1>Venues</h1>
          <p>Live venues from Supabase. Used when creating events.</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" type="button" onClick={openCreate} data-testid="button-add-venue">
            <Plus size={15} /> Add venue
          </button>
        )}
      </div>
      {loading && <p className="muted">Loading venues…</p>}
      {!loading && !rows.length && (
        <div className="surface" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>No venues yet. Add one or run eventsphere-seed.sql.</p>
        </div>
      )}
      <div className="surface table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Venue</th>
              <th>Location</th>
              <th>Capacity</th>
              <th>Scheduled events</th>
              <th>Availability</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.name}</strong></td>
                <td>
                  {v.location || '—'}
                  {v.latitude != null && v.longitude != null && (
                    <div className="mono muted" style={{ fontSize: 11, marginTop: 2 }}>
                      {Number(v.latitude).toFixed(4)}, {Number(v.longitude).toFixed(4)}
                    </div>
                  )}
                </td>
                <td className="mono">{v.capacity}</td>
                <td>{scheduledCount(v.name)}</td>
                <td>
                  <span
                    style={{
                      color:
                        v.availability === 'booked'
                          ? 'var(--danger)'
                          : v.availability === 'limited'
                            ? '#ffca7f'
                            : 'var(--lime)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {v.availability || 'available'}
                  </span>
                </td>
                {canManage && (
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-quiet" type="button" onClick={() => openEdit(v)} aria-label="Edit venue" data-testid={`button-edit-venue-${v.id}`}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-quiet btn-danger" type="button" onClick={() => remove(v)} aria-label="Delete venue" data-testid={`button-delete-venue-${v.id}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <CenterModal title={editing ? 'Edit venue' : 'Add venue'} onClose={closeForm}>
          <div className="form-grid">
            <div>
              <label className="label">Venue name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="input-venue-name"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Capacity</label>
              <input
                className="input"
                type="number"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                data-testid="input-venue-capacity"
              />
            </div>
            <VenueMapPicker
              location={form.location}
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(geo) =>
                setForm((prev) => ({
                  ...prev,
                  location: geo.location ?? prev.location,
                  latitude: geo.latitude,
                  longitude: geo.longitude,
                  map_place_id: geo.map_place_id,
                }))
              }
            />
            <div className="full">
              <label className="label">Availability</label>
              <select
                className="input"
                value={form.availability}
                onChange={(e) => setForm({ ...form, availability: e.target.value })}
              >
                {Object.values(VENUE_AVAILABILITY).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button className="btn" type="button" style={{ flex: 1 }} onClick={closeForm}>
              Cancel
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} type="button" disabled={busy} onClick={save} data-testid="button-save-venue">
              {busy ? 'Saving…' : editing ? 'Update venue' : 'Save venue'}
            </button>
          </div>
        </CenterModal>
      )}
    </>
  )
}
