import { useMemo } from 'react'
import { Clock, Radio } from 'lucide-react'
import {
  formatEventSchedule,
  getEventPhase,
  minutesUntilStart,
  todayLocalDate,
} from '@/lib/eventDate'

/**
 * Student dashboard strip — live / starting soon / today schedule.
 */
export default function StudentSchedulePulse({ events = [], registrations = [], go }) {
  const regIds = useMemo(() => new Set((registrations || []).map(String)), [registrations])

  const mine = useMemo(
    () =>
      (events || []).filter(
        (e) => e.status === 'Approved' && regIds.has(String(e.id)),
      ),
    [events, regIds],
  )

  const live = mine.filter((e) => getEventPhase(e) === 'live')
  const soon = mine.filter((e) => getEventPhase(e) === 'starting_soon')
  const todayUpcoming = mine.filter((e) => {
    const phase = getEventPhase(e)
    return phase === 'upcoming' && String(e.date).slice(0, 10) === todayLocalDate()
  })

  // Also surface campus-wide approved live events (discover signal)
  const campusLive = (events || []).filter(
    (e) => e.status === 'Approved' && getEventPhase(e) === 'live' && !regIds.has(String(e.id)),
  )

  if (!live.length && !soon.length && !todayUpcoming.length && !campusLive.length) {
    return null
  }

  return (
    <div className="section" style={{ marginTop: 0, marginBottom: 18 }}>
      {live.map((e) => (
        <div
          key={`live-${e.id}`}
          className="surface"
          style={{
            padding: 16,
            marginBottom: 10,
            borderColor: 'rgba(182,239,159,.45)',
            background: 'rgba(182,239,159,.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="eyebrow" style={{ color: 'var(--lime)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Radio size={12} /> Live now
              </div>
              <h3 className="display" style={{ margin: '8px 0 4px', fontSize: 20 }}>{e.title}</h3>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>{formatEventSchedule(e)} · {e.venue}</p>
            </div>
            <button className="btn btn-primary" type="button" onClick={() => go(`/student/event/${e.id}`)}>
              Open pass / details
            </button>
          </div>
        </div>
      ))}

      {soon.map((e) => {
        const mins = minutesUntilStart(e)
        return (
          <div
            key={`soon-${e.id}`}
            className="surface"
            style={{
              padding: 16,
              marginBottom: 10,
              borderColor: 'rgba(84,216,232,.4)',
              background: 'rgba(84,216,232,.07)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div className="eyebrow" style={{ color: 'var(--cyan)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} /> Starting soon
                </div>
                <h3 className="display" style={{ margin: '8px 0 4px', fontSize: 20 }}>{e.title}</h3>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  Starts in {mins != null && mins > 0 ? `${mins} min` : 'a moment'} · {formatEventSchedule(e)} · {e.venue}
                </p>
              </div>
              <button className="btn" type="button" onClick={() => go(`/student/passes`)}>
                Show my pass
              </button>
            </div>
          </div>
        )
      })}

      {todayUpcoming.slice(0, 2).map((e) => (
        <div key={`today-${e.id}`} className="surface" style={{ padding: 14, marginBottom: 8 }}>
          <div className="eyebrow">Today on your schedule</div>
          <p style={{ margin: '8px 0 0', fontSize: 13 }}>
            <strong>{e.title}</strong>
            <span className="muted"> · {formatEventSchedule(e)} · {e.venue}</span>
          </p>
        </div>
      ))}

      {!live.length && !soon.length && campusLive.slice(0, 1).map((e) => (
        <div key={`camp-${e.id}`} className="surface" style={{ padding: 14 }}>
          <div className="eyebrow">Happening on campus</div>
          <p style={{ margin: '8px 0 10px', fontSize: 13 }}>
            <strong>{e.title}</strong> is live now · {e.venue}
          </p>
          <button className="btn" type="button" onClick={() => go(`/student/event/${e.id}`)}>
            View event
          </button>
        </div>
      ))}
    </div>
  )
}
