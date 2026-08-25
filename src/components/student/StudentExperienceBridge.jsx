/**
 * Loads student_notices: toasts waitlist promotions, sends EmailJS once, event reminders.
 * Mount only for signed-in students — does not alter registration RPCs.
 */
import { useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  createMyNotice,
  listMyNotices,
  markNoticeEmailSent,
} from '@/services/studentExperience'
import {
  eventsNeedingReminder,
  notifyStudentEmail,
  reminderEmailCopy,
  waitlistPromotedEmailCopy,
} from '@/lib/studentNotify'

export default function StudentExperienceBridge({
  role,
  events = [],
  registrations = [],
  setToast,
}) {
  const { user, profile } = useAuth()
  const ran = useRef(false)

  useEffect(() => {
    if (role !== 'student' || !user?.id) return undefined
    let alive = true

    ;(async () => {
      // 1) Inbox notices (waitlist promote, etc.)
      const { data: notices } = await listMyNotices({ limit: 30 })
      if (!alive) return
      const unreadPromote = (notices || []).filter(
        (n) => n.kind === 'waitlist_promoted' && !n.email_sent,
      )
      for (const n of unreadPromote) {
        setToast?.(n.title || 'A seat opened for you')
        const copy = waitlistPromotedEmailCopy(n.title, n.body)
        const { sent } = await notifyStudentEmail({
          toEmail: profile?.email || user.email,
          toName: profile?.full_name || 'Student',
          ...copy,
          dedupeKey: `notice_email_${n.id}`,
        })
        if (sent) await markNoticeEmailSent(n.id)
      }

      // 2) Event reminders (within 24h) — once per event per browser
      if (ran.current) return
      ran.current = true
      const due = eventsNeedingReminder(events, registrations, 24)
      for (const ev of due) {
        const copy = reminderEmailCopy(ev)
        const { sent } = await notifyStudentEmail({
          toEmail: profile?.email || user.email,
          toName: profile?.full_name || 'Student',
          ...copy,
          dedupeKey: `reminder_${user.id}_${ev.id}_${ev.date}`,
        })
        if (sent) {
          setToast?.(`Reminder emailed: ${ev.title}`)
          await createMyNotice({
            kind: 'event_reminder',
            title: copy.title,
            body: copy.message,
            eventId: ev.id,
            meta: { channel: 'emailjs' },
          })
        }
      }
    })()

    return () => {
      alive = false
    }
  }, [role, user?.id, user?.email, profile?.email, profile?.full_name, events, registrations, setToast])

  return null
}
