function pad(n) {
  return String(n).padStart(2, '0')
}

/** Convert event date + time strings → ICS UTC-ish local stamp (YYYYMMDDTHHMMSS). */
export function toIcsLocalStamp(dateStr, timeStr = '09:00') {
  const d = String(dateStr || '').trim()
  if (!d) return null

  let hours = 9
  let minutes = 0
  const t = String(timeStr || '').trim()
  const m24 = t.match(/^(\d{1,2}):(\d{2})/)
  const m12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (m12) {
    hours = Number(m12[1]) % 12
    if (String(m12[3]).toUpperCase() === 'PM') hours += 12
    minutes = Number(m12[2])
  } else if (m24) {
    hours = Number(m24[1])
    minutes = Number(m24[2])
  }

  const [y, mo, day] = d.split('-').map(Number)
  if (!y || !mo || !day) return null
  return `${y}${pad(mo)}${pad(day)}T${pad(hours)}${pad(minutes)}00`
}

function escapeIcs(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export function buildIcs({ title, description, location, date, time, url, uid }) {
  const start = toIcsLocalStamp(date, time)
  if (!start) return null

  // Default 2-hour duration
  const y = Number(start.slice(0, 4))
  const mo = Number(start.slice(4, 6))
  const day = Number(start.slice(6, 8))
  const hh = Number(start.slice(9, 11))
  const mm = Number(start.slice(11, 13))
  const endDate = new Date(y, mo - 1, day, hh + 2, mm)
  const end = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`

  const stamp = new Date()
  const dtstamp = `${stamp.getUTCFullYear()}${pad(stamp.getUTCMonth() + 1)}${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}${pad(stamp.getUTCSeconds())}Z`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventSphere//Campus Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid || `${Date.now()}@eventsphere`}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description || '')}`,
    `LOCATION:${escapeIcs(location || '')}`,
  ]
  if (url) lines.push(`URL:${escapeIcs(url)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(filename, icsBody) {
  if (!icsBody) return { error: { message: 'Could not build calendar file' } }
  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  a.click()
  URL.revokeObjectURL(href)
  return { error: null }
}
