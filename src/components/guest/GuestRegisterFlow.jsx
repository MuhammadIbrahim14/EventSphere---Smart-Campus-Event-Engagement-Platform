/**
 * Guest event registration — review, referral, terms, free or Stripe checkout.
 */
import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { ArrowRight, CalendarDays, Loader2, MapPin, ShieldCheck, Ticket } from 'lucide-react'
import { getEvent } from '@/services/events'
import { registerForEvent } from '@/services/registrations'
import { createCheckoutSession, confirmCheckoutSession } from '@/services/payments'
import { validatePromoCode, applyPromoDiscount } from '@/services/growth'
import {
  eventRequiresPayment,
  formatMoney,
  formatRegistrationCloses,
  isPublicGuestEvent,
  isRegistrationClosed,
  pricingLabel,
} from '@/lib/eventMappers'
import { formatEventSchedule } from '@/lib/eventDate'

export default function GuestRegisterFlow({ eventId, user, setToast, onComplete, onCancel }) {
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoApplied, setPromoApplied] = useState(null)
  const [promoError, setPromoError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!eventId) {
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await getEvent(eventId)
      if (cancelled) return
      setLoading(false)
      if (error || !data) {
        setToast?.(error?.message || 'Event not found')
        setEvent(null)
        return
      }
      setEvent(data)
    })()
    return () => {
      cancelled = true
    }
  }, [eventId, setToast])

  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : ''
    const q = new URLSearchParams(search)
    if (q.get('paid') !== '1') return
    const sessionId = q.get('session_id')
    const paidEvent = q.get('event') || eventId
    if (!sessionId && !paidEvent) return
    setBusy(true)
    void (async () => {
      const { data, error } = await confirmCheckoutSession({
        sessionId,
        eventId: paidEvent,
      })
      setBusy(false)
      if (error) {
        setToast?.(error.message || 'Could not confirm payment')
        return
      }
      setToast?.(data?.alreadyPaid ? 'Payment already confirmed' : 'Payment confirmed — your guest pass is ready')
      onComplete?.()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <section className="surface es-guest-register" style={{ padding: 24 }}>
        <p className="muted" style={{ margin: 0 }}>
          <Loader2 size={16} style={{ animation: 'spin 0.9s linear infinite', verticalAlign: -3, marginRight: 8 }} />
          Loading event…
        </p>
      </section>
    )
  }

  if (!event) {
    return (
      <section className="surface es-guest-register" style={{ padding: 24 }}>
        <p className="muted" style={{ margin: 0 }}>This event is unavailable.</p>
        <button type="button" className="btn" style={{ marginTop: 12 }} onClick={onCancel}>
          Back to hub
        </button>
      </section>
    )
  }

  if (!isPublicGuestEvent(event)) {
    return (
      <section className="surface es-guest-register" style={{ padding: 24 }}>
        <div className="eyebrow">Campus only</div>
        <h2 className="display" style={{ margin: '8px 0', fontSize: 20 }}>
          Public registration not open
        </h2>
        <p className="muted" style={{ fontSize: 13 }}>
          This event is for campus students only. The organizer has not opened public guest seats.
        </p>
        <Link href="/events" className="btn btn-primary" style={{ marginTop: 14 }}>
          Browse public events
        </Link>
      </section>
    )
  }

  const closed = isRegistrationClosed(event)
  const closes = formatRegistrationCloses(event)
  const publicLeft =
    event.publicSeatsAvailable != null
      ? event.publicSeatsAvailable
      : Math.max(0, Number(event.publicCapacity || 0))
  const needsPay = eventRequiresPayment(event)
  const feeAmount = Number(event.entryFee || 0)
  const depositAmount = Number(event.securityDeposit || 0)
  const discountedFee = promoApplied ? applyPromoDiscount(feeAmount, promoApplied) : feeAmount
  const payTotal = discountedFee + depositAmount

  const applyPromo = async () => {
    setPromoError('')
    if (!promoInput.trim()) {
      setPromoError('Enter a promo code')
      return
    }
    setBusy(true)
    const { data, error } = await validatePromoCode(promoInput, {
      eventId: event.id,
      studentId: user?.id,
    })
    setBusy(false)
    if (error) {
      setPromoApplied(null)
      setPromoError(error.message || 'Invalid code')
      return
    }
    setPromoApplied(data)
    setToast?.(`Promo ${data.code} applied`)
  }

  const submit = async () => {
    if (closed) {
      setToast?.('Registration is closed for this event')
      return
    }
    if (publicLeft <= 0) {
      setToast?.('No public seats remaining')
      return
    }
    if (!acceptedTerms) {
      setToast?.('Please confirm you agree to event rules and contact sharing')
      return
    }
    if (!user?.id) {
      setToast?.('Sign in as a guest to register')
      return
    }

    setBusy(true)
    try {
      if (needsPay) {
        const origin = window.location.origin
        const { data, error } = await createCheckoutSession({
          eventId: event.id,
          promoCode: promoApplied?.code || undefined,
          successUrl: `${origin}/guest?paid=1&event=${encodeURIComponent(event.id)}&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/guest?event=${encodeURIComponent(event.id)}`,
        })
        if (error) {
          setToast?.(error.message || 'Could not start checkout')
          return
        }
        if (data?.alreadyPaid || data?.freeWithPromo) {
          setToast?.(
            data?.freeWithPromo ? 'Promo covered the fee — you are registered.' : 'Already paid — seat confirmed.',
          )
          onComplete?.()
          return
        }
        if (data?.url) {
          window.location.assign(data.url)
          return
        }
        setToast?.('Checkout unavailable — contact the organizer')
        return
      }

      const { data, error } = await registerForEvent(event.id, {
        referralCode: referralCode.trim() || undefined,
      })
      if (error) {
        setToast?.(error.message || 'Registration failed')
        return
      }
      const status = data?.status
      setToast?.(
        status === 'waitlist'
          ? 'Public pool full — you are on the waitlist.'
          : status === 'pending'
            ? 'Registration pending organizer approval.'
            : 'Registered — your guest pass is ready.',
      )
      onComplete?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="surface es-guest-register" style={{ padding: 24 }} data-testid="guest-register-flow">
      <div className="eyebrow">Public registration</div>
      <h2 className="display" style={{ margin: '8px 0 12px', fontSize: 22 }}>{event.title}</h2>

      <div className="es-guest-register__meta">
        <span>
          <CalendarDays size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          {formatEventSchedule(event)}
        </span>
        <span>
          <MapPin size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          {event.venue || 'Campus venue'}
        </span>
        <span>
          <Ticket size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          {needsPay ? pricingLabel(event) : 'Free'} · {publicLeft} public seats left
        </span>
        {closes ? (
          <span>{closed ? 'Registration closed' : `Closes ${closes}`}</span>
        ) : null}
      </div>

      {event.description ? (
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 14 }}>
          {event.description}
        </p>
      ) : null}

      {event.rules ? (
        <div className="es-guest-register__rules" style={{ marginTop: 14 }}>
          <strong style={{ fontSize: 12 }}>Event rules</strong>
          <p className="muted" style={{ fontSize: 12, margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>
            {event.rules}
          </p>
        </div>
      ) : null}

      <div className="form-grid" style={{ marginTop: 20 }}>
        <div className="full">
          <label className="label">Student referral code (optional)</label>
          <input
            className="input"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="If a campus student invited you"
            data-testid="input-guest-register-referral"
          />
        </div>

        {needsPay ? (
          <div className="full">
            <label className="label">Promo code (optional)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="input"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="PROMO"
                style={{ flex: 1, minWidth: 140 }}
              />
              <button type="button" className="btn" disabled={busy} onClick={applyPromo}>
                Apply
              </button>
            </div>
            {promoError ? (
              <p className="subtle" style={{ color: 'var(--danger)', fontSize: 11, marginTop: 6 }}>
                {promoError}
              </p>
            ) : null}
            <p className="subtle" style={{ fontSize: 11, marginTop: 8 }}>
              Total due: <strong>{formatMoney(payTotal, event.currency)}</strong>
              {depositAmount > 0 ? ` (includes ${formatMoney(depositAmount, event.currency)} refundable deposit)` : ''}
            </p>
          </div>
        ) : null}

        <div className="full">
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              data-testid="checkbox-guest-register-terms"
              style={{ marginTop: 3 }}
            />
            <span>
              I confirm my details are correct, I may be contacted about this event, and I agree to follow campus
              venue rules. <ShieldCheck size={12} style={{ verticalAlign: -2 }} />
            </span>
          </label>
        </div>
      </div>

      <div className="es-guest-register__actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || closed || publicLeft <= 0}
          onClick={submit}
          data-testid="button-guest-register-submit"
        >
          {busy ? (
            <>
              <Loader2 size={14} style={{ animation: 'spin 0.9s linear infinite' }} /> Processing…
            </>
          ) : needsPay ? (
            <>Pay {formatMoney(payTotal, event.currency)} <ArrowRight size={14} /></>
          ) : (
            <>Confirm registration <ArrowRight size={14} /></>
          )}
        </button>
      </div>
    </section>
  )
}
