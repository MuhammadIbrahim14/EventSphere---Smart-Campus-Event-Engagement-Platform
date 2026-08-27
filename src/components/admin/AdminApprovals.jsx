import { useState } from 'react'
import { Check, XCircle } from 'lucide-react'
import { EsPageChrome, EventVisualFields } from '@/components/design-system'
import { EVENT_STATUS } from '@/constants/domain'
import { bannerForEvent, characterForEvent } from '@/constants/campusCharacters'
import { formatEventSchedule } from '@/lib/eventDate'
import {
  eventRequiresPayment,
  formatEarlyBirdEnds,
  formatMoney,
  formatRegistrationCloses,
  getEventPricing,
  isPublicGuestEvent,
  pricingLabel,
} from '@/lib/eventMappers'

function StatusBadge({ status }) {
  const label = status || 'Pending'
  return <span className={`badge badge-${String(label).toLowerCase()}`}>{label}</span>
}

function Fact({ label, value, testId }) {
  return (
    <div className="surface-soft fact" data-testid={testId}>
      <div className="fact-label">{label}</div>
      <div className="fact-value">{value}</div>
    </div>
  )
}

function formatPricingDetail(event) {
  const pricing = getEventPricing(event)
  if (!eventRequiresPayment(event)) return 'Free registration'

  const parts = [pricingLabel(event)]
  if (pricing.isEarlyBird && formatEarlyBirdEnds(event)) {
    parts.push(`Early bird until ${formatEarlyBirdEnds(event)}`)
  }
  if (Number(event.entryFee) > 0 && pricing.isEarlyBird) {
    parts.push(`Regular fee ${formatMoney(event.entryFee, event.currency)}`)
  }
  if (Number(event.securityDeposit) > 0) {
    parts.push(`Deposit ${formatMoney(event.securityDeposit, event.currency)} (refundable on Present)`)
  }
  return parts.join(' · ')
}

function ApprovalEventCard({ event, onApprove, onReject, onVisuals, busyId }) {
  const mascot = characterForEvent(event)
  const banner = event.bannerUrl || bannerForEvent(event)
  const schedule = formatEventSchedule(event)
  const regCloses = formatRegistrationCloses(event)
  const publicOpen = isPublicGuestEvent(event)
  const busy = busyId === event.id

  return (
    <article className="surface es-approval-card" style={{ padding: 0, overflow: 'hidden' }} data-testid={`approval-card-${event.id}`}>
      <div
        className="es-approval-card__hero"
        style={{
          minHeight: 120,
          background: event.bannerUrl
            ? `linear-gradient(180deg, rgba(7,6,12,.15), rgba(7,6,12,.88)), url(${event.bannerUrl}) center/cover`
            : `linear-gradient(135deg, rgba(154,123,255,.25), rgba(84,216,232,.18))`,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <img src={mascot.src} alt="" width={52} height={52} style={{ objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={event.status} />
              <span className="badge" style={{ background: 'rgba(84,216,232,.15)', color: 'var(--cyan)' }}>
                {event.category || 'Uncategorized'}
              </span>
              {event.isPromoted ? (
                <span className="badge" style={{ background: 'rgba(255,202,127,.15)', color: '#ffca7f' }}>
                  Promoted
                </span>
              ) : null}
            </div>
            <h2 className="display" style={{ margin: '8px 0 0', fontSize: 22, lineHeight: 1.2 }}>
              {event.title}
            </h2>
          </div>
        </div>
        {!event.bannerUrl && banner ? (
          <img
            src={banner}
            alt=""
            aria-hidden="true"
            style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12, opacity: 0.85 }}
          />
        ) : null}
      </div>

      <div style={{ padding: '18px 20px 20px' }}>
        {event.description ? (
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.65, margin: '0 0 16px' }}>
            {event.description}
          </p>
        ) : (
          <p className="subtle" style={{ fontSize: 12, margin: '0 0 16px' }}>
            No description provided.
          </p>
        )}

        <div className="detail-facts" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <Fact label="When" value={schedule || '—'} testId={`approval-when-${event.id}`} />
          <Fact label="Where" value={event.venue || '—'} testId={`approval-venue-${event.id}`} />
          <Fact label="Organizer" value={event.organizer || '—'} testId={`approval-organizer-${event.id}`} />
          <Fact
            label="Pricing"
            value={formatPricingDetail(event)}
            testId={`approval-pricing-${event.id}`}
          />
          <Fact
            label="Student capacity"
            value={`${event.capacity ?? 0} seats`}
            testId={`approval-capacity-${event.id}`}
          />
          <Fact
            label="Public guests"
            value={
              publicOpen
                ? `${event.publicCapacity ?? 0} public seats`
                : 'Campus students only'
            }
            testId={`approval-public-${event.id}`}
          />
          <Fact
            label="Registration closes"
            value={regCloses || 'Not set'}
            testId={`approval-reg-closes-${event.id}`}
          />
          <Fact
            label="Registration flow"
            value={
              event.registrationRequiresApproval
                ? 'Organizer approval required'
                : 'Auto-confirm when seats available'
            }
            testId={`approval-reg-flow-${event.id}`}
          />
          <Fact
            label="Waitlist"
            value={event.waitlistEnabled === false ? 'Off' : 'On when full'}
            testId={`approval-waitlist-${event.id}`}
          />
          <Fact
            label="Submitted"
            value={
              event.createdAt
                ? new Date(event.createdAt).toLocaleString()
                : '—'
            }
            testId={`approval-submitted-${event.id}`}
          />
        </div>

        {event.rules ? (
          <div className="surface-soft" style={{ padding: 14, marginTop: 14 }}>
            <div className="fact-label">Event rules</div>
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.6, margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
              {event.rules}
            </p>
          </div>
        ) : null}

        <div className="event-actions" style={{ marginTop: 16 }}>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy}
            onClick={() => onApprove(event)}
            data-testid={`button-approve-${event.id}`}
          >
            <Check size={14} /> Approve event
          </button>
          <button
            className="btn btn-danger"
            type="button"
            disabled={busy}
            onClick={() => onReject(event)}
            data-testid={`button-reject-${event.id}`}
          >
            <XCircle size={14} /> Reject
          </button>
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => onVisuals(event)}
            data-testid={`button-approvals-visuals-${event.id}`}
          >
            Visuals
          </button>
        </div>
      </div>
    </article>
  )
}

export default function AdminApprovals({ events = [], setToast, actions }) {
  const [visualEvent, setVisualEvent] = useState(null)
  const [visualForm, setVisualForm] = useState({ bannerUrl: '', characterKey: '', characterUrl: '' })
  const [busyId, setBusyId] = useState(null)

  const pending = events.filter((e) => e.status === 'Pending')

  const openVisuals = (e) => {
    setVisualEvent(e)
    setVisualForm({
      bannerUrl: e.bannerUrl || '',
      characterKey: e.characterKey || '',
      characterUrl: e.characterUrl || '',
    })
  }

  const saveVisuals = async () => {
    if (!visualEvent) return
    setBusyId(visualEvent.id)
    const { error } = await actions.updateEvent(visualEvent.id, {
      bannerUrl: visualForm.bannerUrl?.trim() || null,
      characterKey: visualForm.characterKey || null,
      characterUrl: visualForm.characterUrl?.trim() || null,
    })
    setBusyId(null)
    if (error) {
      setToast?.(error.message)
      return
    }
    setToast?.('Event visuals updated')
    setVisualEvent(null)
  }

  const handleApprove = async (event) => {
    setBusyId(event.id)
    const { error } = await actions.setStatus(event.id, EVENT_STATUS.APPROVED)
    setBusyId(null)
    setToast?.(error ? error.message : `${event.title} approved`)
  }

  const handleReject = async (event) => {
    setBusyId(event.id)
    const { error } = await actions.setStatus(event.id, EVENT_STATUS.REJECTED)
    setBusyId(null)
    setToast?.(error ? error.message : `${event.title} rejected`)
  }

  return (
    <>
      <EsPageChrome
        eyebrow="Review queue"
        title="Event approvals"
        description="Review the full submission — schedule, venue, pricing, capacity, and rules — before approving."
      />

      {pending.length ? (
        <div className="grid-2 stagger">
          {pending.map((event) => (
            <ApprovalEventCard
              key={event.id}
              event={event}
              busyId={busyId}
              onApprove={handleApprove}
              onReject={handleReject}
              onVisuals={openVisuals}
            />
          ))}
        </div>
      ) : (
        <div className="surface es-empty" style={{ padding: 28, textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px' }}>Queue is clear</h3>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            No pending events. Organizer submissions appear here for review.
          </p>
        </div>
      )}

      {visualEvent ? (
        <div className="surface" style={{ padding: 18, marginTop: 14 }} data-testid="approvals-visuals-panel">
          <div className="section-title">
            <h2>Visuals · {visualEvent.title}</h2>
            <button className="btn btn-quiet" type="button" onClick={() => setVisualEvent(null)}>
              Close
            </button>
          </div>
          <EventVisualFields
            bannerUrl={visualForm.bannerUrl}
            characterKey={visualForm.characterKey}
            characterUrl={visualForm.characterUrl}
            onChange={(patch) => setVisualForm((f) => ({ ...f, ...patch }))}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button className="btn" type="button" onClick={() => setVisualEvent(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busyId === visualEvent.id}
              onClick={saveVisuals}
            >
              {busyId === visualEvent.id ? 'Saving…' : 'Save visuals'}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
