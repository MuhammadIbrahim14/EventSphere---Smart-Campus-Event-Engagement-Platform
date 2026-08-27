import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, Plus, Trash2, Upload, Users } from 'lucide-react'
import { EsPageChrome } from '@/components/design-system'
import { useMascotLibrary } from '@/context/MascotLibraryContext'
import {
  createCampusMascot,
  deleteCampusMascot,
  updateCampusMascot,
  updateMascotExperienceSettings,
  uploadCampusMascotAsset,
} from '@/services/mascots'

function ToggleRow({ label, hint, checked, onChange, testId }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 0',
        borderBottom: '1px solid var(--line)',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      <span>
        <strong style={{ display: 'block', fontWeight: 600 }}>{label}</strong>
        {hint ? <span className="muted" style={{ fontSize: 11 }}>{hint}</span> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
    </label>
  )
}

export default function AdminMascotLibrary({ setToast }) {
  const { library, settings, loading, refresh } = useMascotLibrary()
  const [label, setLabel] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadEnabled, setUploadEnabled] = useState(settings.student_upload_enabled !== false)
  const [maxMb, setMaxMb] = useState(settings.max_upload_mb || 2)
  const fileRef = useRef(null)

  useEffect(() => {
    setUploadEnabled(settings.student_upload_enabled !== false)
    setMaxMb(settings.max_upload_mb || 2)
  }, [settings])

  const reload = useCallback(async () => {
    await refresh({ includeDisabled: true })
  }, [refresh])

  useEffect(() => {
    reload()
  }, [reload])

  const onAdminUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    const { data, error } = await uploadCampusMascotAsset(file)
    setBusy(false)
    if (error) {
      setToast?.(error.message || 'Upload failed')
      return
    }
    setImageUrl(data.publicUrl || '')
    setToast?.('Image uploaded — add a label and save to library')
  }

  const addMascot = async () => {
    if (!label.trim() || !imageUrl.trim()) {
      setToast?.('Label and image URL required')
      return
    }
    setBusy(true)
    const { error } = await createCampusMascot({ label: label.trim(), imageUrl: imageUrl.trim() })
    setBusy(false)
    if (error) {
      setToast?.(error.message || 'Could not add mascot')
      return
    }
    setLabel('')
    setImageUrl('')
    setToast?.('Mascot added to campus library')
    await reload()
  }

  const toggleEnabled = async (row) => {
    setBusy(true)
    const { error } = await updateCampusMascot(row.db_id, { enabled: !row.enabled })
    setBusy(false)
    if (error) setToast?.(error.message)
    else await reload()
  }

  const removeMascot = async (row) => {
    if (row.is_builtin) return
    setBusy(true)
    const { error } = await deleteCampusMascot(row.db_id)
    setBusy(false)
    if (error) setToast?.(error.message)
    else {
      setToast?.('Mascot removed')
      await reload()
    }
  }

  const saveSettings = async () => {
    setBusy(true)
    const { error } = await updateMascotExperienceSettings({
      student_upload_enabled: uploadEnabled,
      max_upload_mb: maxMb,
    })
    setBusy(false)
    if (error) setToast?.(error.message || 'Could not save settings')
    else {
      setToast?.('Student mascot settings updated')
      await reload()
    }
  }

  return (
    <>
      <EsPageChrome
        eyebrow="Platform appearance"
        title="Mascot library"
        description="Manage campus mascots for the student vibe chip. Built-ins stay seeded; add PNG/WebP assets students can pick. Toggle custom student uploads below."
      />

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 16 }}>
        <div className="surface" style={{ padding: 21 }}>
          <div className="eyebrow">Student experience</div>
          <h2 className="display" style={{ margin: '8px 0 12px', fontSize: 20 }}>Custom upload slot</h2>
          <ToggleRow
            label="Allow student mascot upload"
            hint="Shows “Choose your mascot” in the vibe chip popover"
            checked={uploadEnabled}
            onChange={setUploadEnabled}
            testId="toggle-student-mascot-upload"
          />
          <div style={{ marginTop: 12 }}>
            <label className="label">Max upload size ({maxMb}MB)</label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={maxMb}
              onChange={(e) => setMaxMb(Number(e.target.value))}
              data-testid="range-mascot-max-mb"
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            disabled={busy}
            onClick={saveSettings}
            data-testid="button-save-mascot-settings"
          >
            {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Save student rules
          </button>
        </div>

        <div className="surface" style={{ padding: 21 }}>
          <div className="eyebrow">Add to library</div>
          <h2 className="display" style={{ margin: '8px 0 12px', fontSize: 20 }}>New campus mascot</h2>
          <div className="form-grid">
            <div className="full">
              <label className="label">Display label</label>
              <input
                className="input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Night owl"
                data-testid="input-mascot-label"
              />
            </div>
            <div className="full">
              <label className="label">Image URL</label>
              <input
                className="input"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…/mascot.png"
                data-testid="input-mascot-url"
              />
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={onAdminUpload} />
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Upload PNG
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={addMascot} data-testid="button-add-mascot">
              <Plus size={14} /> Add to library
            </button>
          </div>
          {imageUrl ? (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={imageUrl} alt="" width={56} height={56} style={{ objectFit: 'contain' }} />
              <span className="muted" style={{ fontSize: 11 }}>Preview</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="surface" style={{ padding: 21 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Users size={18} style={{ color: 'var(--es-ice)' }} />
          <div>
            <div className="eyebrow">Campus library</div>
            <h2 className="display" style={{ margin: '4px 0 0', fontSize: 20 }}>
              {loading ? 'Loading…' : `${library.length} mascots`}
            </h2>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Preview</th>
                <th>Label</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {library.map((row) => (
                <tr key={row.db_id || row.id}>
                  <td>
                    <img src={row.src || row.image_url} alt="" width={44} height={44} style={{ objectFit: 'contain' }} />
                  </td>
                  <td>
                    <strong>{row.label}</strong>
                    {row.is_builtin ? <span className="badge badge-approved" style={{ marginLeft: 8 }}>Built-in</span> : null}
                  </td>
                  <td className="subtle">{row.slug || row.id}</td>
                  <td>{row.enabled !== false ? 'Live' : 'Hidden'}</td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => toggleEnabled(row)}>
                      {row.enabled !== false ? 'Hide' : 'Show'}
                    </button>
                    {!row.is_builtin ? (
                      <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => removeMascot(row)}>
                        <Trash2 size={13} /> Remove
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
