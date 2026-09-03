import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Loader2, Mail, Save, UserRound } from 'lucide-react'
import { EsPageChrome } from '@/components/design-system'
import { useAuth } from '@/context/AuthContext'
import UserAvatar from '@/components/shared/UserAvatar'
import { updateMyProfile, validateUsername } from '@/services/profiles'
import { uploadAvatar } from '@/services/storage'
import {
  sendPersonalEmailOtp,
  verifyPersonalEmailOtp,
} from '@/services/personalEmail'
import { isEmailJsConfigured } from '@/lib/emailjs'
import { isSyntheticCampusEmail } from '@/lib/enrollmentAuth'

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
  const [personalEmail, setPersonalEmail] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [emailStep, setEmailStep] = useState(1)
  const [emailBusy, setEmailBusy] = useState(false)

  const provisioned = Boolean(profile?.provisioned)
  const personalVerified = Boolean(profile?.personal_email_verified)

  useEffect(() => {
    setFullName(profile?.full_name || '')
    setUsername(profile?.username || '')
    setMobile(profile?.mobile || '')
    setDepartment(profile?.department || '')
    setEnrollmentNo(profile?.enrollment_no || '')
    setBio(profile?.bio || '')
    setAvatarUrl(profile?.avatar_url || '')
    setPersonalEmail(profile?.personal_email || '')
    if (profile?.personal_email_verified) setEmailStep(1)
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
    const payload = {
      full_name: name,
      username: userCheck.username,
      mobile: mobile.trim() || null,
      department: department.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl || null,
    }
    if (!provisioned) {
      payload.enrollment_no = enrollmentNo.trim() || null
    }
    const { error } = await updateMyProfile(payload)
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
              {provisioned
                ? 'Login with enrollment. Link a personal email below for recovery — campus Auth mail is never shown.'
                : 'Email and role are managed by campus auth / admins.'}
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              {isSyntheticCampusEmail(profile?.email || user?.email)
                ? profile?.personal_email_verified
                  ? profile.personal_email
                  : `Enrollment ${profile?.enrollment_no || enrollmentNo || '—'}`
                : profile?.email || user?.email || '—'}
            </p>
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
              <Field
                label="Enrollment / student ID"
                hint={provisioned ? 'Issued by campus admin — cannot be changed here.' : undefined}
              >
                <input
                  className="input"
                  value={enrollmentNo}
                  onChange={(e) => setEnrollmentNo(e.target.value)}
                  maxLength={80}
                  disabled={provisioned}
                  readOnly={provisioned}
                  data-testid="input-profile-enrollment"
                />
              </Field>
            ) : null}
            {role === 'student' ? (
              <div className="full" style={{ gridColumn: '1 / -1' }}>
                <Field
                  label="Personal email (privacy)"
                  hint={
                    personalVerified
                      ? 'Verified — you can also login with this email and use Forgot password.'
                      : 'Optional. Link a personal email with OTP to unlock email login + password recovery.'
                  }
                >
                  {personalVerified ? (
                    <input className="input" value={profile?.personal_email || ''} readOnly disabled />
                  ) : (
                    <>
                      <input
                        className="input"
                        type="email"
                        value={personalEmail}
                        onChange={(e) => setPersonalEmail(e.target.value)}
                        placeholder="you@email.com"
                        data-testid="input-profile-personal-email"
                        disabled={emailStep === 2}
                      />
                      {emailStep === 2 ? (
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          <input
                            className="input"
                            style={{ flex: 1, minWidth: 120 }}
                            inputMode="numeric"
                            maxLength={6}
                            value={emailOtp}
                            onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="6-digit OTP"
                            data-testid="input-profile-personal-otp"
                          />
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={emailBusy || emailOtp.length !== 6}
                            onClick={async () => {
                              setEmailBusy(true)
                              const { ok, error } = await verifyPersonalEmailOtp(emailOtp)
                              setEmailBusy(false)
                              if (!ok || error) {
                                setToast?.(error?.message || 'Invalid code')
                                return
                              }
                              await refreshProfile?.()
                              setEmailStep(1)
                              setEmailOtp('')
                              setToast?.('Personal email verified')
                            }}
                            data-testid="button-verify-personal-email"
                          >
                            {emailBusy ? 'Verifying…' : 'Verify'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-quiet"
                            onClick={() => {
                              setEmailStep(1)
                              setEmailOtp('')
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-quiet"
                          style={{ marginTop: 10 }}
                          disabled={emailBusy || !isEmailJsConfigured}
                          onClick={async () => {
                            if (!isEmailJsConfigured) {
                              setToast?.('EmailJS is not configured')
                              return
                            }
                            setEmailBusy(true)
                            const { error } = await sendPersonalEmailOtp(personalEmail)
                            setEmailBusy(false)
                            if (error) {
                              setToast?.(error.message)
                              return
                            }
                            setEmailStep(2)
                            setToast?.('OTP sent to your personal email')
                          }}
                          data-testid="button-send-personal-email-otp"
                        >
                          <Mail size={14} /> {emailBusy ? 'Sending…' : 'Send OTP to link email'}
                        </button>
                      )}
                    </>
                  )}
                </Field>
              </div>
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
