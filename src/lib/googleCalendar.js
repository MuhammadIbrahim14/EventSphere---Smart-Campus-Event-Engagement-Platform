/**
 * Google Calendar deep link + ICS helpers (additive).
 */
import { toIcsLocalStamp } from './ics.js'

function pad(n) {
  return String(n).padStart(2, '0')
}

function stampToGoogle(stamp) {
  // YYYYMMDDTHHMMSS → YYYYMMDDTHHMMSS (Google accepts local without Z for template)
  return String(stamp || '').replace(/[-:]/g, '')
}

function endStampFromStart(startStamp, endTime, dateStr) {
  if (endTime && dateStr) {
    const end = toIcsLocalStamp(dateStr, endTime)
    if (end) return end
  }
  if (!startStamp || startStamp.length < 15) return null
  const y = Number(startStamp.slice(0, 4))
  const mo = Number(startStamp.slice(4, 6))
  const day = Number(startStamp.slice(6, 8))
  const hh = Number(startStamp.slice(9, 11))
  const mm = Number(startStamp.slice(11, 13))
  const endDate = new Date(y, mo - 1, day, hh + 2, mm)
  return `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`
}

/**
 * Open Google Calendar “create event” template in a new tab.
 */
export function buildGoogleCalendarUrl({
  title,
  description,
  location,
  date,
  time,
  endTime,
  url,
}) {
  const start = toIcsLocalStamp(date, time || '09:00')
  if (!start) return null
  const end = endStampFromStart(start, endTime, date) || start
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'EventSphere event',
    dates: `${stampToGoogle(start)}/${stampToGoogle(end)}`,
    details: [description || '', url ? `EventSphere: ${url}` : ''].filter(Boolean).join('\n'),
    location: location || '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function openGoogleCalendar(event, pageUrl) {
  const href = buildGoogleCalendarUrl({
    title: event?.title,
    description: event?.description,
    location: event?.venue,
    date: event?.date,
    time: event?.time,
    endTime: event?.endTime,
    url: pageUrl,
  })
  if (!href) return { error: { message: 'Missing event date for Google Calendar' } }
  window.open(href, '_blank', 'noopener,noreferrer')
  return { error: null }
}
