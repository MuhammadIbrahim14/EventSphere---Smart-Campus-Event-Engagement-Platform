import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Loader2, Save, UserRound } from 'lucide-react'
import { EsPageChrome } from '@/components/design-system'
import { useAuth } from '@/context/AuthContext'
import UserAvatar from '@/components/shared/UserAvatar'
import { updateMyProfile, validateUsername } from '@/services/profiles'
import { uploadAvatar } from '@/services/storage'

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint ? <p className="muted" style={{ margin: '6px 0 0', fontSize: 11 }}>{hint}</p> : null}
    </div>
  )
}

export default function ProfileManage({ role, setToast, go }) {
  const { user, profile, refreshProfile } = useAuth()
  const fileRef = useRef(null)

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [mobile, setMobile] = useState('')
  const [department, setDepartment] = useState('')
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setFullName(profile?.full_name || '')
    setUsername(profile?.username || '')
    setMobile(profile?.mobile || '')
    setDepartment(profile?.department || '')
    setEnrollmentNo(profile?.enrollment_no || '')
    setBio(profile?.bio || '')
    setAvatarUrl(profile?.avatar_url || '')
  }, [profile])

  const initials = String(fullName || profile?.full_name || 'ES')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user?.id) return

    setUploading(true)
    const { data, error } = await uploadAvatar(file, user.id)
    if (error || !data?.publicUrl) {
      setUploading(false)
      setToast?.(error?.message || 'Could not upload photo')
      return
    }

    const { error: saveErr } = await updateMyProfile({ avatar_url: data.publicUrl })
    setUploading(false)
    if (saveErr) {
      setToast?.(saveErr.message || 'Photo uploaded but profile save failed')
      return
    }

    setAvatarUrl(data.publicUrl)
    await refreshProfile?.()
    setToast?.('Profile photo updated')
  }

  const onRemoveAvatar = async () => {
    if (!avatarUrl) return
    setBusy(true)
    const { error } = await updateMyProfile({ avatar_url: null })
    setBusy(false)
    if (error) {
      setToast?.(error.message)
      return
    }
    setAvatarUrl('')
    await refreshProfile?.()
    setToast?.('Profile photo removed')
  }

  const onSave = async (e) => {
    e?.preventDefault?.()
    const name = fullName.trim()
    if (!name) {
      setToast?.('Full name is required')
      return
    }
    const userCheck = validateUsername(username)
    if (!userCheck.ok) {
      setToast?.(userCheck.error)
      return
    }

    setBusy(true)
    const { error } = await updateMyProfile({
      full_name: name,
      username: userCheck.username,
      mobile: mobile.trim() || null,
      department: department.trim() || null,
      enrollment_no: enrollmentNo.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl || null,
    })
    setBusy(false)

    if (error) {
      setToast?.(error.message || 'Could not save profile')
      return
    }

    await refreshProfile?.()
    setSaved(true)
    setToast?.('Profile saved')
    window.setTimeout(() => setSaved(false), 1600)
  }

  return (
    <>
      <EsPageChrome
        eyebrow="Your identity"
        title="Profile"
        description="Update your photo, name, username, and campus details. Changes save to your EventSphere account."
        action={
          go ? (
            <button type="button" className="btn btn-quiet" onClick={() => go(`/${role}/settings`)}>
              Open settings
            </button>
          ) : null
        }
      />

      <form onSubmit={onSave} className="grid-2" style={{ alignItems: 'start' }}>
        <div className="surface" style={{ padding: 24 }} data-testid="profile-photo-card">
          <div className="eyebrow">Photo</div>
          <h2 className="display" style={{ margin: '8px 0 16px', fontSize: 22 }}>Profile picture</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <UserAvatar
              src={avatarUrl}
              initials={initials}
              size={88}
              className={role === 'organizer' ? 'avatar-cyan' : ''}
              style={{ fontSize: 28 }}
            />
            <div style={{ flex: 1, minWidth: 180 }}>
              <p className="muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
                PNG, WebP, or JPG · max 2MB. Shown in your sidebar and workspace.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={uploading || busy}
                  onClick={() => fileRef.current?.click()}
                  data-testid="button-upload-avatar"
                >
                  {uploading ? <Loader2 size={14} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Camera size={14} />}
                  {uploading ? 'Uploading…' : 'Upload photo'}
                </button>
                {avatarUrl ? (
                  <button type="button" className="btn btn-quiet" disabled={busy || uploading} onClick={onRemoveAvatar}>
                    Remove
                  </button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/webp,image/jpeg"
                hidden
                onChange={onPickAvatar}
              />
            </div>
          </div>

          <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
            <div className="eyebrow">Account</div>
            <p className="muted" style={{ fontSize: 12, margin: '8px 0 4px' }}>
              Email and role are managed by campus auth / admins.
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>{profile?.email || user?.email || '—'}</p>
            <p className="subtle" style={{ margin: '6px 0 0', fontSize: 11, textTransform: 'capitalize' }}>
              {role} · read-only role
            </p>
          </div>
        </div>

        <div className="surface" style={{ padding: 24 }} data-testid="profile-details-card">
          <div className="eyebrow">Details</div>
          <h2 className="display" style={{ margin: '8px 0 16px', fontSize: 22 }}>
            <UserRound size={18} style={{ marginRight: 8, verticalAlign: -3 }} />
            About you
          </h2>

          <div className="form-grid">
            <Field label="Full name">
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                maxLength={80}
                data-testid="input-profile-fullname"
              />
            </Field>
            <Field label="Username" hint="3–24 chars · letters, numbers, underscore">
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                placeholder="campus_handle"
                maxLength={24}
                spellCheck={false}
                data-testid="input-profile-username"
              />
            </Field>
            <Field label="Phone">
              <input
                className="input"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+92…"
                maxLength={20}
                inputMode="tel"
                data-testid="input-profile-phone"
              />
            </Field>
            <Field label="Department / organization">
              <input
                className="input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                maxLength={80}
                data-testid="input-profile-department"
              />
            </Field>
            {role === 'student' ? (
              <Field label="Enrollment / student ID">
                <input
                  className="input"
                  value={enrollmentNo}
                  onChange={(e) => setEnrollmentNo(e.target.value)}
                  maxLength={80}
                  data-testid="input-profile-enrollment"
                />
              </Field>
            ) : null}
            <div className="full">
              <Field label="Bio" hint={`${bio.length}/280`}>
                <textarea
                  className="input"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 280))}
                  rows={3}
                  maxLength={280}
                  placeholder="Short campus intro…"
                  data-testid="input-profile-bio"
                  style={{ resize: 'vertical', minHeight: 88 }}
                />
              </Field>
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || uploading}
              data-testid="button-save-profile"
            >
              {busy ? (
                <><Loader2 size={14} style={{ animation: 'spin 0.9s linear infinite' }} /> Saving…</>
              ) : saved ? (
                <><Check size={14} /> Saved</>
              ) : (
                <><Save size={14} /> Save profile</>
              )}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
