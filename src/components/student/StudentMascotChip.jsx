import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Loader2, Sparkles, Upload } from 'lucide-react'
import { EsMascotPicker } from '@/components/design-system'
import { pickerValueFromPref } from '@/lib/studentMascot'
import { uploadStudentMascot } from '@/services/mascots'

export default function StudentMascotChip({
  pref,
  heroMascot,
  library = [],
  settings = {},
  pickLibrary,
  pickCustom,
  update,
  ready,
  syncing,
  setToast,
  userId,
}) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const rootRef = useRef(null)
  const fileRef = useRef(null)

  const pickerOptions = library.map((m) => ({
    id: m.id || m.slug,
    label: m.label,
    src: m.src || m.image_url,
  }))

  const pickerValue = pickerValueFromPref(pref, library)
  const uploadEnabled = settings.student_upload_enabled !== false

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onPick = (id) => {
    if (id === 'custom') return
    const label = library.find((m) => (m.id || m.slug) === id)?.label || 'updated'
    pickLibrary?.(id)
    setToast?.(`Your vibe is now ${label}`)
    setOpen(false)
  }

  const toggleAccent = () => {
    update?.({ showAccent: !pref.showAccent })
    setToast?.(pref.showAccent ? 'Paper plane accent hidden' : 'Paper plane accent on')
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !userId) return

    setUploading(true)
    const { data, error } = await uploadStudentMascot(file, userId, {
      maxMb: settings.max_upload_mb || 2,
    })
    setUploading(false)

    if (error) {
      setToast?.(error.message || 'Upload failed')
      return
    }

    pickCustom?.(data.publicUrl)
    setToast?.('Your custom mascot is live on your dashboard')
    setOpen(false)
  }

  return (
    <div className="stu-dash__vibe-chip-wrap" ref={rootRef}>
      <button
        type="button"
        className={`stu-dash__vibe-chip${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={!ready}
        data-testid="button-student-mascot-chip"
      >
        <Sparkles size={13} aria-hidden="true" />
        <span className="stu-dash__vibe-chip-label">
          Your vibe · <strong>{heroMascot.label}</strong>
          {syncing ? <Loader2 size={11} className="stu-dash__vibe-sync" aria-hidden="true" /> : null}
        </span>
        <ChevronDown size={14} className="stu-dash__vibe-chip-caret" aria-hidden="true" />
      </button>

      {open ? (
        <div className="stu-dash__vibe-popover surface" role="dialog" aria-label="Choose your dashboard mascot">
          <div className="eyebrow">Main character pick</div>
          <p className="muted" style={{ fontSize: 11, margin: '6px 0 12px', lineHeight: 1.45 }}>
            Campus library from admins + your own upload. Saved to your profile — syncs across devices.
          </p>

          {pickerOptions.length ? (
            <EsMascotPicker
              options={pickerOptions}
              value={pickerValue === 'custom' ? '' : pickerValue}
              onChange={onPick}
              size="sm"
              testIdPrefix="student-hero-mascot"
            />
          ) : (
            <p className="muted" style={{ fontSize: 11 }}>Loading mascot library…</p>
          )}

          {uploadEnabled ? (
            <div className="stu-dash__vibe-upload">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/webp,image/jpeg"
                hidden
                onChange={onFile}
                data-testid="input-student-mascot-upload"
              />
              <button
                type="button"
                className="btn btn-quiet stu-dash__vibe-upload-btn"
                disabled={uploading || !userId}
                onClick={() => fileRef.current?.click()}
                data-testid="button-student-mascot-upload"
              >
                {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                Choose your mascot
              </button>
              <p className="muted" style={{ fontSize: 10, margin: '6px 0 0' }}>
                PNG / WebP / JPG · max {settings.max_upload_mb || 2}MB · transparent PNG looks best
              </p>
              {pref.source === 'custom' && pref.customUrl ? (
                <div className="stu-dash__vibe-custom-preview">
                  <img src={pref.customUrl} alt="" draggable={false} />
                  <span>Your upload is active</span>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 10, marginTop: 10 }}>
              Custom uploads are disabled by campus admin.
            </p>
          )}

          <label className="stu-dash__vibe-accent-toggle">
            <input
              type="checkbox"
              checked={pref.showAccent}
              onChange={toggleAccent}
              data-testid="checkbox-student-mascot-accent"
            />
            <span>Show paper plane accent</span>
          </label>
        </div>
      ) : null}
    </div>
  )
}
