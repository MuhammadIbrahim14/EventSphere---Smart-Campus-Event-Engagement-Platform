export function todayLocalDate() {
  const d = new Date()
  return formatLocalYmd(d)
}

function formatLocalYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Normalize time to HH:MM (24h). Accepts "8:30", "08:30", "08:30 AM". */
export function normalizeTimeHHmm(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampm) {
    let h = Number(ampm[1])
    const min = ampm[2]
    const ap = ampm[3].toUpperCase()
    if (ap === 'PM' && h < 12) h += 12
    if (ap === 'AM' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${min}`
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})/)
  if (m24) {
    return `${String(Number(m24[1])).padStart(2, '0')}:${m24[2]}`
  }
  return s.slice(0, 5)
}

/** Local Date from event date + time (defaults 00:00 if no time). */
export function eventStartDate(event) {
  const date = String(event?.date || event?.event_date || '').slice(0, 10)
  const time = normalizeTimeHHmm(event?.time || event?.event_time) || '00:00'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const d = new Date(`${date}T${time}:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** End Date: uses endTime, else start + 2 hours. */
export function eventEndDate(event) {
  const date = String(event?.date || event?.event_date || '').slice(0, 10)
  const end = normalizeTimeHHmm(event?.endTime || event?.event_end_time)
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(`${date}T${end}:00`)
    if (!Number.isNaN(d.getTime())) return d
  }
  const start = eventStartDate(event)
  if (!start) return null
  return new Date(start.getTime() + 2 * 60 * 60 * 1000)
}

export function addHoursToTime(timeHHmm, hours = 2) {
  const t = normalizeTimeHHmm(timeHHmm) || '09:00'
  const [h, m] = t.split(':').map(Number)
  const d = new Date(2000, 0, 1, h || 0, m || 0, 0)
  d.setHours(d.getHours() + (Number(hours) || 2))
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** True when event_date is today or in the past (local calendar day). */
export function isEventDayOrPast(eventDate) {
  const raw = String(eventDate || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false
  return raw <= todayLocalDate()
}

export function eventNotStartedMessage(eventDate) {
  return `Event date is ${String(eventDate || '').slice(0, 10)}. Attendance unlocks on that day.`
}

/** Add days to a YYYY-MM-DD string (local noon to avoid TZ slips). */
export function addDaysToDate(eventDate, days = 7) {
  const raw = String(eventDate || todayLocalDate()).slice(0, 10)
  const d = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) {
    const t = new Date()
    t.setDate(t.getDate() + (Number(days) || 7))
    return formatLocalYmd(t)
  }
  d.setDate(d.getDate() + (Number(days) || 7))
  return formatLocalYmd(d)
}

/**
 * Phase of an event relative to now.
 * @returns {'upcoming'|'starting_soon'|'live'|'ended'|'unknown'}
 */
export function getEventPhase(event, now = new Date()) {
  const start = eventStartDate(event)
  const end = eventEndDate(event)
  if (!start || !end) return 'unknown'
  const ms = now.getTime()
  if (ms >= end.getTime()) return 'ended'
  if (ms >= start.getTime()) return 'live'
  const mins = (start.getTime() - ms) / 60000
  if (mins <= 60) return 'starting_soon'
  return 'upcoming'
}

export function isEventEnded(event, now = new Date()) {
  return getEventPhase(event, now) === 'ended'
}

export function isEventLive(event, now = new Date()) {
  return getEventPhase(event, now) === 'live'
}

export function formatEventSchedule(event) {
  const date = String(event?.date || '').slice(0, 10)
  const start = normalizeTimeHHmm(event?.time) || '—'
  const end = normalizeTimeHHmm(event?.endTime) || addHoursToTime(event?.time, 2)
  return `${date} · ${start}–${end}`
}

export function minutesUntilStart(event, now = new Date()) {
  const start = eventStartDate(event)
  if (!start) return null
  return Math.round((start.getTime() - now.getTime()) / 60000)
}
