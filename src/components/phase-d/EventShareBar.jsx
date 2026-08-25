import { Calendar, Copy, Share2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { buildIcs, downloadIcs } from '@/lib/ics'
import { eventShareText, shareLinks } from '@/lib/share'
import { logCalendarSync } from '@/services/calendar'
import { logEventShare } from '@/services/share'

/** Phase D — Add to calendar + social share (additive; does not touch register flow). */
export default function EventShareBar({ event, setToast }) {
  const { user } = useAuth()
  if (!event) return null

  const url = typeof window !== 'undefined' ? window.location.href : ''
  const links = shareLinks(event, url)

  async function addToCalendar() {
    const body = buildIcs({
      title: event.title,
      description: event.description,
      location: event.venue,
      date: event.date,
      time: event.time,
      url,
      uid: `${event.id}@eventsphere`,
    })
    const { error } = downloadIcs(`${event.symbol || 'event'}-eventsphere`, body)
    if (error) {
      setToast?.(error.message)
      return
    }
    setToast?.('Calendar file downloaded (.ics)')
    if (user?.id) {
      await logCalendarSync({ userId: user.id, eventId: event.id, calendarUrl: url })
    }
  }

  async function share(platform) {
    const message = eventShareText(event, url)
    if (platform === 'copy') {
      try {
        await navigator.clipboard?.writeText(url)
        setToast?.('Event link copied')
      } catch {
        setToast?.('Could not copy link')
      }
    } else {
      window.open(links[platform], '_blank', 'noopener,noreferrer')
      setToast?.(`Opening ${platform}…`)
    }
    await logEventShare({
      userId: user?.id || null,
      eventId: event.id,
      platform,
      shareMessage: message,
    })
  }

  return (
    <div className="surface" style={{ padding: 16, marginTop: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Share & calendar</h2>
        <Share2 size={15} className="muted" />
      </div>
      <div className="event-actions" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-primary" type="button" onClick={addToCalendar} data-testid="button-add-calendar">
          <Calendar size={14} /> Add to calendar
        </button>
        <button className="btn" type="button" onClick={() => share('whatsapp')} data-testid="button-share-whatsapp">
          WhatsApp
        </button>
        <button className="btn" type="button" onClick={() => share('twitter')} data-testid="button-share-twitter">
          Twitter / X
        </button>
        <button className="btn" type="button" onClick={() => share('facebook')} data-testid="button-share-facebook">
          Facebook
        </button>
        <button className="btn" type="button" onClick={() => share('copy')} data-testid="button-share-copy">
          <Copy size={14} /> Copy link
        </button>
      </div>
    </div>
  )
}
