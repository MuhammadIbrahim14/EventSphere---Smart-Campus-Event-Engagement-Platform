/**
 * Student experience helpers — emails + local dedupe. Never throws into UI flows.
 */
import { sendCampusNotify, isEmailJsConfigured } from './emailjs.js'
import { minutesUntilStart } from './eventDate.js'

const LS_PREFIX = 'eventsphere_notify_'

function onceKey(key) {
  try {
    if (localStorage.getItem(LS_PREFIX + key)) return false
    localStorage.setItem(LS_PREFIX + key, String(Date.now()))
    return true
  } catch {
    return true
  }
}

export async function notifyStudentEmail({
  toEmail,
  toName,
  subject,
  title,
  message,
  dedupeKey,
}) {
  if (!isEmailJsConfigured || !toEmail) return { sent: false, error: null }
  if (dedupeKey && !onceKey(dedupeKey)) return { sent: false, error: null }
  const { error } = await sendCampusNotify({
    toEmail,
    toName,
    subject,
    title,
    message,
  })
  return { sent: !error, error }
}

export function registrationEmailCopy(event, status) {
  const title = event?.title || 'Campus event'
  if (status === 'waitlist') {
    return {
      subject: `Waitlisted — ${title}`,
      title: 'You are on the waitlist',
      message: `You joined the waitlist for "${title}". We will notify you if a seat opens.`,
    }
  }
  if (status === 'pending') {
    return {
      subject: `Pending approval — ${title}`,
      title: 'Registration pending',
      message: `Your registration for "${title}" is pending organizer/admin approval.`,
    }
  }
  return {
    subject: `Registered — ${title}`,
    title: 'Registration confirmed',
    message: `You are registered for "${title}" on ${event?.date || 'the event date'} at ${event?.venue || 'campus'}.`,
  }
}

export function paymentSuccessEmailCopy(event) {
  const title = event?.title || 'Campus event'
  return {
    subject: `Payment received — ${title}`,
    title: 'Payment successful',
    message: `Stripe payment confirmed for "${title}". Your seat / pass is unlocked in EventSphere.`,
  }
}

export function reminderEmailCopy(event) {
  const title = event?.title || 'Campus event'
  return {
    subject: `Reminder — ${title} starts in 12 hours`,
    title: 'Your event will start in 12 hours',
    message: `Event: ${title}\nDate: ${event?.date || 'TBA'}\nTime: ${event?.time || 'TBA'}\nVenue: ${event?.venue || 'Campus'}\n\nYour event will start in 12 hours. Open EventSphere → My passes for your QR.`,
  }
}

export function waitlistPromotedEmailCopy(title, body) {
  return {
    subject: title || 'Seat opened for you',
    title: title || 'Waitlist promoted',
    message: body || 'A seat opened — you are now registered. Check My registrations / My passes.',
  }
}

/** Events starting within the next `withinHours` that the student is registered for. */
export function eventsNeedingReminder(events, registrationIds, withinHours = 24) {
  const ids = new Set((registrationIds || []).map(String))
  const maxMins = withinHours * 60
  return (events || []).filter((e) => {
    if (!ids.has(String(e.id))) return false
    const m = minutesUntilStart(e)
    return m != null && m >= 0 && m <= maxMins
  })
}
