import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { CheckCircle2, LogIn, QrCode, ShieldAlert, XCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { stashAuthNext } from '@/lib/authReturn'
import { formatEventSchedule } from '@/lib/eventDate'
import { stationSelfCheckIn } from '@/services/attendance'
import { getEventCheckinMeta } from '@/services/events'
import { uiRoleFromProfile } from '@/constants/roles'

/**
 * Venue station check-in — opened by Camera / Google Lens scanning the poster URL.
 * Path: /checkin/:eventId?t=TOKEN
 */
export default function StationCheckinPage() {
  const [, params] = useRoute('/checkin/:eventId')
  const [, setLocation] = useLocation()
  const { user, profile, loading: authLoading } = useAuth()
  const eventId = params?.eventId || ''
  const token = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('t') || ''
    } catch {
      return ''
    }
  }, [])

  const [meta, setMeta] = useState(null)
  const [metaError, setMetaError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const returnPath = `/checkin/${encodeURIComponent(eventId)}?t=${encodeURIComponent(token)}`
  const role = profile ? uiRoleFromProfile(profile.role) : null

  const loadMeta = useCallback(async () => {
    if (!eventId) return
    const { data, error } = await getEventCheckinMeta(eventId)
    if (error) {
      setMetaError(error.message)
      setMeta(null)
      return
    }
    setMetaError('')
    setMeta(data)
  }, [eventId])

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  const runCheckIn = useCallback(async () => {
    if (!user?.id || !eventId || !token) return
    setBusy(true)
    setResult(null)
    const res = await stationSelfCheckIn({
      eventId,
      token,
      studentId: user.id,
    })
    setBusy(false)
    setResult(res)
  }, [user?.id, eventId, token])

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) return
    if (!eventId || !token) return
    // Auto-attempt once signed in
    runCheckIn()
  }, [authLoading, user?.id, eventId, token, runCheckIn])

  const goLogin = () => {
    stashAuthNext(returnPath)
    setLocation(`/login?next=${encodeURIComponent(returnPath)}`)
  }

  const title = meta?.title || result?.event?.title || 'Event check-in'
  const venue = meta?.venue || result?.event?.venue || ''
  const schedule = meta
    ? formatEventSchedule({
        date: meta.event_date,
        time: meta.event_time,
        endTime: meta.event_end_time,
      })
    : ''

  const code = result?.code
  const ok = code === 'ok' || code === 'already'
  const errMsg = result?.error?.message || metaError

  return (
    <div className="es-checkin" data-testid="station-checkin-page">
      <div className="es-checkin__card">
        <div className="es-checkin__badge">
          <QrCode size={18} /> Station check-in
        </div>
        <h1 className="es-checkin__title">{title}</h1>
        {(schedule || venue) && (
          <p className="es-checkin__meta">
            {schedule}
            {schedule && venue ? ' · ' : ''}
            {venue}
          </p>
        )}

        {authLoading ? (
          <p className="muted" style={{ marginTop: 24 }}>
            Checking session…
          </p>
        ) : !user ? (
          <div className="es-checkin__action">
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
              Sign in with the account you used to register. Camera / Lens only opened this page —
              attendance marks after login.
            </p>
            <button type="button" className="btn btn-primary" onClick={goLogin} data-testid="button-checkin-login">
              <LogIn size={16} /> Sign in to mark present
            </button>
          </div>
        ) : role && role !== 'student' ? (
          <div className="es-checkin__result es-checkin__result--warn">
            <ShieldAlert size={28} />
            <strong>Use a student account</strong>
            <p className="muted" style={{ fontSize: 13 }}>
              Station check-in is for registered students. Organizers mark others from Attendees.
            </p>
            <button type="button" className="btn" onClick={() => setLocation(`/${role}/dashboard`)}>
              Open {role} dashboard
            </button>
          </div>
        ) : busy && !result ? (
          <p className="muted" style={{ marginTop: 24 }}>
            Marking attendance…
          </p>
        ) : ok ? (
          <div className="es-checkin__result es-checkin__result--ok" data-testid="checkin-success">
            <CheckCircle2 size={36} />
            <strong>{code === 'already' ? 'Already marked present' : 'You are present'}</strong>
            <p className="muted" style={{ fontSize: 13 }}>
              {code === 'already'
                ? 'This station QR already recorded you for this event.'
                : 'Station QR check-in saved. Enjoy the event.'}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setLocation('/student/passes')}>
              My passes
            </button>
          </div>
        ) : errMsg ? (
          <div className="es-checkin__result es-checkin__result--err" data-testid="checkin-error">
            <XCircle size={32} />
            <strong>Check-in blocked</strong>
            <p style={{ fontSize: 14, margin: '8px 0 0' }}>{errMsg}</p>
            {code === 'not_registered' ? (
              <button
                type="button"
                className="btn"
                style={{ marginTop: 14 }}
                onClick={() => setLocation(`/student/event/${eventId}`)}
              >
                View event
              </button>
            ) : (
              <button type="button" className="btn" style={{ marginTop: 14 }} disabled={busy} onClick={runCheckIn}>
                Try again
              </button>
            )}
          </div>
        ) : !token ? (
          <div className="es-checkin__result es-checkin__result--err">
            <XCircle size={28} />
            <strong>Missing poster code</strong>
            <p className="muted" style={{ fontSize: 13 }}>
              Scan the official venue QR (URL must include <code>?t=</code>).
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
