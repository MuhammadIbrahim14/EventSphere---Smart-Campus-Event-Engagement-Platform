/**
 * Guest Hub — single secure page for public attendees (no student shell).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'wouter'
import {
  CalendarDays,
  Ticket,
  ShieldCheck,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import QrPass from '@/components/phase-c/QrPass'
import GuestRegisterFlow from '@/components/guest/GuestRegisterFlow'
import PublicShell from '@/pages/public/PublicShell'
import { listMyRegistrations } from '@/services/registrations'
import { getEvent } from '@/services/events'
import { applyReferralCode, ensureMyReferralCode } from '@/services/growth'
import { formatEventSchedule, isEventEnded } from '@/lib/eventDate'
import { REGISTRATION_STATUS } from '@/constants/domain'
import { useMascotLibrary } from '@/context/MascotLibraryContext'
import { PublicMascotBadge, resolvePublicMascot } from '@/components/public/PublicMascotScene'

const ACTIVE = new Set([
  REGISTRATION_STATUS.CONFIRMED,
  REGISTRATION_STATUS.WAITLIST,
  REGISTRATION_STATUS.PENDING,
  REGISTRATION_STATUS.PENDING_PAYMENT,
])

export default function GuestHub({ onLogout, setToast }) {
  const { user, profile, refreshProfile } = useAuth()
  const { enabledLibrary } = useMascotLibrary()
  const hubMascot = resolvePublicMascot('plane', enabledLibrary)
  const [path, setLocation] = useLocation()
  const [regs, setRegs] = useState([])
  const [eventsById, setEventsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [friendCode, setFriendCode] = useState('')
  const [myReferral, setMyReferral] = useState('')

  const eventFromQuery = useMemo(() => {
    try {
      const q = new URLSearchParams(path.includes('?') ? path.split('?')[1] : window.location.search)
      return q.get('event') || ''
    } catch {
      return ''
    }
  }, [path])

  const identity = useMemo(() => {
    const name = profile?.full_name || 'Guest'
    const initials = String(name)
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    return {
      name,
      email: profile?.email || user?.email,
      avatarUrl: profile?.avatar_url,
      initials,
    }
  }, [profile, user])

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data, error } = await listMyRegistrations(user.id)
    if (error) setToast?.(error.message)
    const rows = data || []
    setRegs(rows)

    const ids = [...new Set(rows.map((r) => r.eventId || r.event_id).filter(Boolean))]
    const map = {}
    await Promise.all(
      ids.map(async (id) => {
        const { data: ev } = await getEvent(id)
        if (ev) map[id] = ev
      }),
    )
    setEventsById(map)

    const ref = await ensureMyReferralCode(user.id)
    if (ref.data?.referral_code) setMyReferral(ref.data.referral_code)

    setLoading(false)
  }, [user?.id, setToast])

  useEffect(() => {
    load()
  }, [load])

  const applyRef = async () => {
    if (!user?.id) return
    const { error } = await applyReferralCode(user.id, friendCode)
    if (error) setToast?.(error.message)
    else {
      setToast?.('Referral applied')
      setFriendCode('')
      await refreshProfile?.()
    }
  }

  const clearEventQuery = () => {
    setLocation('/guest')
  }

  const onRegisterComplete = async () => {
    clearEventQuery()
    await load()
  }

  const activeRegs = regs.filter((r) => ACTIVE.has(r.status))

  return (
    <PublicShell
      variant="hub"
      hideTitle
      identity={identity}
      onLogout={onLogout}
    >
      <div className="es-guest-hub-content" data-testid="guest-hub">
        <section className="surface es-guest-hub__identity">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div className="es-guest-hub__badge">
                <ShieldCheck size={12} /> Public guest
              </div>
              <h1 className="display" style={{ margin: '10px 0 6px', fontSize: 26 }}>
                {profile?.full_name || 'Guest'}
              </h1>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                {profile?.email || user?.email}
                {profile?.username ? ` · @${profile.username}` : ''}
              </p>
              <p className="subtle" style={{ margin: '8px 0 0', fontSize: 12 }}>
                Your secure hub — registrations and QR passes only. No campus dashboard access.
              </p>
            </div>
            <PublicMascotBadge mascot={hubMascot} size="md" />
          </div>
        </section>

        {eventFromQuery ? (
          <GuestRegisterFlow
            eventId={eventFromQuery}
            user={user}
            setToast={setToast}
            onComplete={onRegisterComplete}
            onCancel={clearEventQuery}
          />
        ) : null}

        <section className="surface" style={{ padding: 22 }}>
          <div className="eyebrow">Referral</div>
          <h2 className="display" style={{ margin: '8px 0 12px', fontSize: 20 }}>Student reference</h2>
          <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
            If a campus student invited you, enter their referral code (optional).
          </p>
          {myReferral ? (
            <p className="subtle" style={{ fontSize: 11, marginBottom: 10 }}>
              Your guest code: <code>{myReferral}</code>
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="input"
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
              placeholder="STUDENT CODE"
              data-testid="input-guest-referral"
              style={{ flex: 1, minWidth: 160 }}
            />
            <button type="button" className="btn" onClick={applyRef} data-testid="button-guest-apply-referral">
              Apply
            </button>
          </div>
        </section>

        <section className="surface" style={{ padding: 22 }}>
          <div className="eyebrow">Your orbit</div>
          <h2 className="display" style={{ margin: '8px 0 12px', fontSize: 20 }}>
            <Ticket size={18} style={{ verticalAlign: -3, marginRight: 8 }} />
            Registrations & passes
          </h2>
          {loading ? (
            <p className="muted">
              <Loader2 size={14} style={{ animation: 'spin 0.9s linear infinite', verticalAlign: -2, marginRight: 6 }} />
              Loading…
            </p>
          ) : null}
          {!loading && !activeRegs.length ? (
            <div className="es-guest-hub__empty">
              <p className="muted" style={{ margin: 0 }}>No active public registrations yet.</p>
              <Link href="/events" className="btn btn-primary" style={{ marginTop: 12 }}>
                Find public events <ArrowRight size={14} />
              </Link>
            </div>
          ) : null}
          <div className="es-guest-hub__regs">
            {activeRegs.map((r) => {
              const eid = r.eventId || r.event_id
              const ev = eventsById[eid]
              const ended = ev ? isEventEnded(ev) : false
              return (
                <article key={r.id || `${eid}-${r.status}`} className="es-guest-hub__reg surface">
                  <div>
                    <strong>{ev?.title || 'Event'}</strong>
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: 11 }}>
                      <CalendarDays size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                      {ev ? formatEventSchedule(ev) : '—'}
                      {' · '}
                      <span style={{ textTransform: 'capitalize' }}>{r.status}</span>
                      {ended ? ' · ended' : ''}
                    </p>
                  </div>
                  {r.status === REGISTRATION_STATUS.CONFIRMED && !ended ? (
                    <QrPass
                      eventId={eid}
                      studentId={user.id}
                      token={r.id || 'pass'}
                      size={96}
                      label="Guest pass QR"
                    />
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>Pass when confirmed</span>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </PublicShell>
  )
}
