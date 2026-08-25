import EsPageChrome from './EsPageChrome'
import EsReveal from './EsReveal'
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  UserCheck,
  Users,
  Check,
  Eye,
} from 'lucide-react'
import { EVENT_STATUS } from '@/constants/domain'
import EventVisualFields from './EventVisualFields'
import { useState } from 'react'

function Badge({ status }) {
  const label = status || 'Pending'
  return <span className={`badge badge-${String(label).toLowerCase()}`}>{label}</span>
}

/**
 * Admin dashboard — calmer design-system skin. Presentation only.
 */
export default function AdminDashboard({ events = [], go, actions, setToast }) {
  const [visualEvent, setVisualEvent] = useState(null)
  const [visualForm, setVisualForm] = useState({
    bannerUrl: '',
    characterKey: '',
    characterUrl: '',
  })
  const [busy, setBusy] = useState(false)

  const cards = [
    ['Total Events', String(events.length), 'live', CalendarDays, 'var(--es-ice)'],
    [
      'Pending Approvals',
      String(events.filter((e) => e.status === 'Pending').length),
      'queue',
      ClipboardCheck,
      'var(--es-hot)',
    ],
    [
      'Approved',
      String(events.filter((e) => e.status === 'Approved').length),
      'live',
      Users,
      'var(--es-neon)',
    ],
    [
      'Drafts',
      String(events.filter((e) => e.status === 'Draft').length),
      'workspace',
      UserCheck,
      'var(--es-sun)',
    ],
  ]
  const shown = events.slice(0, 6)

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
    setBusy(true)
    const { error } = await actions.updateEvent(visualEvent.id, {
      bannerUrl: visualForm.bannerUrl?.trim() || null,
      characterKey: visualForm.characterKey || null,
      characterUrl: visualForm.characterUrl?.trim() || null,
    })
    setBusy(false)
    if (error) {
      setToast?.(error.message)
      return
    }
    setToast?.('Event visuals updated')
    setVisualEvent(null)
  }

  return (
    <div className="es-role-dash" data-testid="admin-dashboard-v2">
      <EsPageChrome
        eyebrow="01 · Admin control center"
        title="Command overview"
        description="Monitor the campus event ecosystem — same campus frame as student and organizer."
        action={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => go('/admin/approvals')}
            data-testid="button-primary-head"
          >
            Review approvals <ArrowRight size={15} />
          </button>
        }
      />
      <div className="es-role-dash__stats">
        {cards.map(([label, value, note, Icon, color]) => (
          <EsReveal key={label} className="es-role-dash__stat" y={24}>
            <div className="es-role-dash__stat-label">
              <span>{label}</span>
              <Icon size={14} style={{ color }} />
            </div>
            <div className="es-role-dash__stat-value" style={{ color }}>
              {value}
            </div>
            <div className="subtle" style={{ fontSize: 11, marginTop: 6 }}>
              {note}
            </div>
          </EsReveal>
        ))}
      </div>

      <div className="section">
        <div className="section-title">
          <h2>Recent events</h2>
          <button className="btn btn-quiet" type="button" onClick={() => go('/admin/events')} data-testid="button-view-all">
            View all
          </button>
        </div>
        <div className="surface table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Organizer</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.title}</strong>
                    <br />
                    <span className="subtle">{e.category}</span>
                  </td>
                  <td>{e.organizer}</td>
                  <td>{e.date}</td>
                  <td>
                    <Badge status={e.status} />
                  </td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-quiet"
                      type="button"
                      onClick={() => go('/admin/events')}
                      data-testid={`button-table-view-${e.id}`}
                    >
                      <Eye size={14} />
                    </button>
                    {e.status === 'Pending' && (
                      <button
                        className="btn btn-quiet"
                        type="button"
                        onClick={async () => {
                          const { error } = await actions.setStatus(e.id, EVENT_STATUS.APPROVED)
                          setToast?.(error ? error.message : `${e.title} approved`)
                        }}
                        data-testid={`button-table-approve-${e.id}`}
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button className="btn btn-quiet" type="button" onClick={() => openVisuals(e)} data-testid={`button-visuals-${e.id}`}>
                      Visuals
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {visualEvent && (
        <div className="surface" style={{ padding: 18, marginTop: 12 }} data-testid="admin-visuals-panel">
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
            <button className="btn btn-primary" type="button" disabled={busy} onClick={saveVisuals}>
              {busy ? 'Saving…' : 'Save visuals'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
