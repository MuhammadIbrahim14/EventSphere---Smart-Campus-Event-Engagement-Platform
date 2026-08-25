import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { formatEventSchedule, getEventPhase, todayLocalDate } from '@/lib/eventDate'

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function parseYmd(raw) {
  const s = String(raw || '').slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]), ymd: s }
}

function buildMonthGrid(year, monthIndex) {
  // monthIndex: 0-11
  const first = new Date(year, monthIndex, 1)
  const startPad = first.getDay() // 0 = Sunday
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells = []

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ key: `pad-b-${i}`, day: null, inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const ymd = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ key: ymd, day: d, inMonth: true, ymd })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `pad-a-${cells.length}`, day: null, inMonth: false })
  }
  // Prefer 6 rows (42) for stable height when needed
  while (cells.length < 35) {
    cells.push({ key: `pad-x-${cells.length}`, day: null, inMonth: false })
  }
  return cells
}

function initialCursor() {
  const today = todayLocalDate()
  const p = parseYmd(today)
  if (p && p.y === 2026) return { year: 2026, month: p.mo - 1 }
  if (p && p.y > 2026) return { year: 2026, month: 11 }
  return { year: 2026, month: 0 }
}

function phaseClass(phase) {
  if (phase === 'ended') return 'cal-ended'
  if (phase === 'live') return 'cal-live'
  if (phase === 'starting_soon') return 'cal-soon'
  return ''
}

function phaseLabel(phase) {
  if (phase === 'ended') return 'Ended'
  if (phase === 'live') return 'Live'
  if (phase === 'starting_soon') return 'Soon'
  return null
}

/**
 * Student calendar — full 2026 month grid with registered events.
 * Reflects Live / Soon / Ended from event start–end times.
 */
export default function StudentCalendar({ events = [], registrations = [], go }) {
  const [cursor, setCursor] = useState(initialCursor)
  const [clock, setClock] = useState(0)
  const today = todayLocalDate()

  // Re-evaluate ended/live phases while the calendar is open
  useEffect(() => {
    const id = setInterval(() => setClock((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const phaseNow = useMemo(() => new Date(), [clock])

  const registeredEvents = useMemo(() => {
    const ids = new Set((registrations || []).map(String))
    return (events || []).filter((e) => ids.has(String(e.id)) && e.date)
  }, [events, registrations])

  const byDate = useMemo(() => {
    const map = new Map()
    registeredEvents.forEach((e) => {
      const key = String(e.date).slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(e)
    })
    return map
  }, [registeredEvents])

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  )

  const monthLabel = `${MONTHS[cursor.month]} ${cursor.year}`

  function prevMonth() {
    setCursor((c) => {
      if (c.month === 0) {
        if (c.year <= 2026) return { year: 2026, month: 0 }
        return { year: c.year - 1, month: 11 }
      }
      return { year: c.year, month: c.month - 1 }
    })
  }

  function nextMonth() {
    setCursor((c) => {
      if (c.month === 11) {
        if (c.year >= 2026) return { year: 2026, month: 11 }
        return { year: c.year + 1, month: 0 }
      }
      return { year: c.year, month: c.month + 1 }
    })
  }

  function goToday() {
    setCursor(initialCursor())
  }

  const monthEvents = registeredEvents
    .filter((e) => {
      const p = parseYmd(e.date)
      return p && p.y === cursor.year && p.mo === cursor.month + 1
    })
    .slice()
    .sort((a, b) => {
      const dateCmp = String(a.date).localeCompare(String(b.date))
      if (dateCmp !== 0) return dateCmp
      const order = { live: 0, starting_soon: 1, upcoming: 2, unknown: 3, ended: 4 }
      return (order[getEventPhase(a, phaseNow)] ?? 3) - (order[getEventPhase(b, phaseNow)] ?? 3)
    })

  const endedCount = monthEvents.filter((e) => getEventPhase(e, phaseNow) === 'ended').length
  const activeCount = monthEvents.length - endedCount

  const canPrev = !(cursor.year === 2026 && cursor.month === 0)
  const canNext = !(cursor.year === 2026 && cursor.month === 11)
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Your year in view</div>
          <h1>Calendar</h1>
          <p>2026 campus calendar — registered events update to Live, Soon, or Ended by schedule.</p>
        </div>
        <button className="btn" type="button" onClick={() => go('/student/discover')}>
          <Plus size={14} /> Find an event
        </button>
      </div>

      <div className="surface" style={{ padding: 17 }}>
        <div className="section-title">
          <h2>{monthLabel}</h2>
          <div className="toolbar">
            <button className="btn" type="button" onClick={goToday} data-testid="button-cal-today">
              Today
            </button>
            <button
              className="btn"
              type="button"
              onClick={prevMonth}
              disabled={!canPrev}
              aria-label="Previous month"
              data-testid="button-cal-prev"
            >
              ‹
            </button>
            <button
              className="btn"
              type="button"
              onClick={nextMonth}
              disabled={!canNext}
              aria-label="Next month"
              data-testid="button-cal-next"
            >
              ›
            </button>
          </div>
        </div>

        <div className="calendar" data-testid="student-calendar-2026">
          {WEEKDAYS.map((d) => (
            <div className="cal-head" key={d}>{d}</div>
          ))}
          {cells.map((cell) => {
            const dayEvents = cell.ymd ? byDate.get(cell.ymd) || [] : []
            const isToday = cell.ymd === today
            return (
              <div
                className={`cal-day ${!cell.inMonth ? 'subtle' : ''} ${isToday ? 'cal-today' : ''}`}
                key={cell.key}
              >
                {cell.day != null && <strong>{cell.day}</strong>}
                {dayEvents.slice(0, 2).map((ev) => {
                  const phase = getEventPhase(ev, phaseNow)
                  const tag = phaseLabel(phase)
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className={`cal-event ${phaseClass(phase)}`}
                      onClick={() => go(`/student/event/${ev.id}`)}
                      data-testid={`button-calendar-event-${ev.id}`}
                      title={`${ev.title} · ${formatEventSchedule(ev)}${tag ? ` · ${tag}` : ''}`}
                    >
                      {tag ? `${tag} · ` : ''}{ev.title}
                    </button>
                  )
                })}
                {dayEvents.length > 2 && (
                  <span className="subtle" style={{ fontSize: 9 }}>
                    +{dayEvents.length - 2} more
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="section surface" style={{ padding: 18, marginTop: 16 }}>
        <div className="section-title">
          <h2>This month</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            {activeCount} active{endedCount ? ` · ${endedCount} ended` : ''} · {monthEvents.length} registered
          </span>
        </div>
        {!monthEvents.length ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            No registered events in {monthLabel}. Discover an approved event and register to see it here.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {monthEvents.map((ev) => {
              const phase = getEventPhase(ev, phaseNow)
              const tag = phaseLabel(phase)
              return (
                <button
                  key={ev.id}
                  type="button"
                  className="btn"
                  style={{
                    justifyContent: 'space-between',
                    width: '100%',
                    opacity: phase === 'ended' ? 0.72 : 1,
                  }}
                  onClick={() => go(`/student/event/${ev.id}`)}
                  data-testid={`button-calendar-month-${ev.id}`}
                >
                  <span style={{ textAlign: 'left' }}>
                    <strong>{ev.title}</strong>
                    <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                      {formatEventSchedule(ev)} · {ev.venue || 'TBA'}
                    </span>
                  </span>
                  <span
                    className={`badge ${phase === 'ended' ? 'badge-draft' : ''}`}
                    style={
                      phase === 'live'
                        ? { background: 'rgba(182,239,159,.18)', color: 'var(--lime)' }
                        : phase === 'starting_soon'
                          ? { background: 'rgba(84,216,232,.18)', color: 'var(--cyan)' }
                          : phase === 'ended'
                            ? undefined
                            : { background: 'rgba(154,123,255,.14)', color: 'var(--violet)' }
                    }
                  >
                    {tag || 'Upcoming'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
