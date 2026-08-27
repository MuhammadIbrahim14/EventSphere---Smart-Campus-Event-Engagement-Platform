/**
 * Guest Hub — single secure page for public attendees (no student shell).
 * Passes use the same wallet card + fullscreen QR as campus students.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'wouter'
import {
  CalendarDays,
  Ticket,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Download,
  Copy,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import QrPass from '@/components/phase-c/QrPass'
import GuestRegisterFlow from '@/components/guest/GuestRegisterFlow'
import AttendeeBadgeCard from '@/components/shared/AttendeeBadgeCard'
import PublicShell from '@/pages/public/PublicShell'
import { listMyRegistrations } from '@/services/registrations'
import { getEvent } from '@/services/events'
import { applyReferralCode, ensureMyReferralCode } from '@/services/growth'
import { buildAttendancePayload } from '@/lib/qrPayload'
import { formatEventSchedule, isEventEnded } from '@/lib/eventDate'
import { PAYMENT_STATUS, PAYMENT_STATUS_LABEL, REGISTRATION_STATUS } from '@/constants/domain'
import { useMascotLibrary } from '@/context/MascotLibraryContext'
import { PublicMascotBadge, resolvePublicMascot } from '@/components/public/PublicMascotScene'

const ACTIVE = new Set([
  REGISTRATION_STATUS.CONFIRMED,
  REGISTRATION_STATUS.WAITLIST,
  REGISTRATION_STATUS.PENDING,
  REGISTRATION_STATUS.PENDING_PAYMENT,
])

function hasPassQr(row) {
  if (!row) return false
  if (row.status === REGISTRATION_STATUS.PENDING_PAYMENT) return false
  if (row.paymentStatus === PAYMENT_STATUS.PENDING || row.paymentStatus === PAYMENT_STATUS.EXPIRED) return false
  return (
    row.status === REGISTRATION_STATUS.CONFIRMED ||
    row.status === REGISTRATION_STATUS.PENDING ||
    row.paymentStatus === PAYMENT_STATUS.NOT_REQUIRED ||
    row.paymentStatus === PAYMENT_STATUS.PAID ||
    row.paymentStatus === PAYMENT_STATUS.PARTIALLY_REFUNDED
  )
}

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
  const [walletId, setWalletId] = useState(null)

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

  const attendee = identity.name

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

  useEffect(() => {
    if (!walletId) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setWalletId(null)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [walletId])

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
  const passRegs = activeRegs.filter((r) => hasPassQr(r))
  const walletReg = passRegs.find((r) => String(r.eventId || r.event_id) === String(walletId))
  const walletEvent = walletReg ? eventsById[walletReg.eventId || walletReg.event_id] : null

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

        <section className="es-guest-passes" data-testid="guest-passes">
          <div className="eyebrow">Your credentials</div>
          <h2 className="display" style={{ margin: '8px 0 6px', fontSize: 22 }}>
            <Ticket size={18} style={{ verticalAlign: -3, marginRight: 8 }} />
            My passes
          </h2>
          <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
            Same door wallet as campus students — open <strong>Wallet view</strong> for a large QR the organizer can scan.
          </p>

          {loading ? (
            <p className="muted">
              <Loader2 size={14} style={{ animation: 'spin 0.9s linear infinite', verticalAlign: -2, marginRight: 6 }} />
              Loading passes…
            </p>
          ) : null}

          {!loading && !activeRegs.length ? (
            <div className="surface es-guest-hub__empty" style={{ padding: 22 }}>
              <p className="muted" style={{ margin: 0 }}>No active public registrations yet.</p>
              <Link href="/events" className="btn btn-primary" style={{ marginTop: 12 }}>
                Find public events <ArrowRight size={14} />
              </Link>
            </div>
          ) : null}

          {!loading && activeRegs.length ? (
            <div className="grid-2 stagger es-guest-passes__grid">
              {activeRegs.map((r) => {
                const eid = r.eventId || r.event_id
                const ev = eventsById[eid]
                const ended = ev ? isEventEnded(ev) : false
                const showQr = hasPassQr(r)
                const payload = buildAttendancePayload({
                  eventId: eid,
                  studentId: user?.id,
                  token: r.id || 'pass',
                })
                const payLabel =
                  r.paymentStatus && r.paymentStatus !== PAYMENT_STATUS.NOT_REQUIRED
                    ? PAYMENT_STATUS_LABEL[r.paymentStatus] || r.paymentStatus
                    : 'Free'
                const statusLabel = String(r.status || '').replace(/_/g, ' ')

                return (
                  <div className="surface pass" key={r.id || `${eid}-${r.status}`} data-testid={`card-guest-pass-${eid}`}>
                    <div className="pass-top">
                      <div className="eyebrow">EventSphere · Guest · {payLabel}</div>
                      <h2 className="display" style={{ fontSize: 25, margin: '16px 0 6px' }}>
                        {ev?.title || 'Event'}
                      </h2>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {ev ? `${ev.date || ''} · ${ev.venue || ''}` : '—'}
                        {' · '}
                        <span style={{ textTransform: 'capitalize' }}>{statusLabel}</span>
                        {ended ? ' · ended' : ''}
                      </div>
                      {ev ? (
                        <p className="subtle" style={{ margin: '8px 0 0', fontSize: 11 }}>
                          <CalendarDays size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                          {formatEventSchedule(ev)}
                        </p>
                      ) : null}
                    </div>
                    <div className="pass-bottom">
                      <div>
                        <div className="subtle" style={{ fontSize: 9, letterSpacing: '.12em' }}>ATTENDEE</div>
                        <strong style={{ display: 'block', marginTop: 5 }}>{attendee}</strong>
                        <div className="subtle mono" style={{ marginTop: 16, fontSize: 10 }}>
                          REG · ES-{String(eid).slice(0, 4).toUpperCase()}
                        </div>
                      </div>
                      {showQr ? (
                        <QrPass
                          eventId={eid}
                          studentId={user?.id}
                          token={r.id || 'pass'}
                          size={96}
                          label={`Guest QR pass for ${ev?.title || 'event'}`}
                        />
                      ) : (
                        <span className="muted" style={{ fontSize: 11, maxWidth: 120, textAlign: 'right' }}>
                          Pass when confirmed / paid
                        </span>
                      )}
                    </div>
                    {showQr ? (
                      <div style={{ padding: '0 24px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={() => setWalletId(eid)}
                          data-testid={`button-guest-wallet-${eid}`}
                        >
                          Wallet view
                        </button>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(payload)
                            setToast?.('QR payload copied')
                          }}
                          data-testid={`button-guest-copy-pass-${eid}`}
                        >
                          <Download size={14} /> Copy QR payload
                        </button>
                        <Link href={`/events/${eid}`} className="btn btn-quiet">
                          View event
                        </Link>
                      </div>
                    ) : (
                      <div style={{ padding: '0 24px 20px' }}>
                        <Link href={`/events/${eid}`} className="btn btn-quiet">
                          View event
                        </Link>
                      </div>
                    )}
                    {showQr ? (
                      <div style={{ padding: '0 24px 18px' }}>
                        <AttendeeBadgeCard
                          name={attendee}
                          eventTitle={ev?.title || 'Event'}
                          roleLabel="Public guest"
                          eventDate={`${ev?.date || ''} · ${ev?.time || ''}`}
                          venue={ev?.venue}
                          setToast={setToast}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>
      </div>

      {walletEvent && walletReg
        ? createPortal(
            <div
              className="pass-wallet-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="guest-pass-wallet-title"
              onMouseDown={(e) => e.target === e.currentTarget && setWalletId(null)}
            >
              <div className="pass-wallet-sheet">
                <div className="pass-wallet-bar">
                  <span className="eyebrow" style={{ color: 'inherit' }}>EventSphere wallet · Guest</span>
                  <button className="icon-btn" type="button" onClick={() => setWalletId(null)} aria-label="Close wallet view">
                    <X size={18} />
                  </button>
                </div>
                <h2 id="guest-pass-wallet-title" className="display" style={{ fontSize: 28, margin: '8px 0 6px', color: '#f4f5ff' }}>
                  {walletEvent.title}
                </h2>
                <p className="muted" style={{ color: '#c9cbe0', margin: 0 }}>
                  {walletEvent.date} · {walletEvent.venue}
                </p>
                <div className="pass-wallet-qr">
                  <QrPass
                    eventId={walletEvent.id}
                    studentId={user?.id}
                    token={walletReg.id || 'pass'}
                    size={220}
                    label={`Fullscreen guest QR for ${walletEvent.title}`}
                  />
                </div>
                <p style={{ color: '#f4f5ff', fontWeight: 600, margin: '18px 0 4px' }}>{attendee}</p>
                <p className="subtle" style={{ color: '#aeb1c8', fontSize: 12, margin: 0 }}>
                  Hold phone steady for organizer scan · Esc to close
                </p>
                <button
                  className="btn"
                  type="button"
                  style={{ marginTop: 18, width: '100%' }}
                  onClick={() => {
                    const payload = buildAttendancePayload({
                      eventId: walletEvent.id,
                      studentId: user?.id,
                      token: walletReg.id || 'pass',
                    })
                    navigator.clipboard?.writeText(payload)
                    setToast?.('QR payload copied')
                  }}
                >
                  <Copy size={14} /> Copy payload
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </PublicShell>
  )
}
