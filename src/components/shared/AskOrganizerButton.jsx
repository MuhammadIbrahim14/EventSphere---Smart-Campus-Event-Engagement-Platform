import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { askOrganizer, listQuestionsForEvent } from '@/services/questions'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export default function AskOrganizerButton({ eventId, eventTitle, setToast, compact = false }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [thread, setThread] = useState([])
  const [loadingThread, setLoadingThread] = useState(false)

  const loadThread = useCallback(async () => {
    if (!user?.id || !eventId) return
    setLoadingThread(true)
    const { data, error } = await listQuestionsForEvent(eventId, { studentId: user.id })
    setLoadingThread(false)
    if (error) {
      setToast?.(error.message)
      return
    }
    setThread(data || [])
  }, [eventId, user?.id, setToast])

  useEffect(() => {
    if (!open) return undefined
    loadThread()
    if (!isSupabaseConfigured) return undefined
    const channel = supabase
      .channel(`ask-org-${eventId}-${user?.id || 'x'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_questions',
          filter: `event_id=eq.${eventId}`,
        },
        () => loadThread(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [open, eventId, user?.id, loadThread])

  if (!user?.id || !eventId) return null

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!question.trim()) return
    setBusy(true)
    const { data, error } = await askOrganizer({
      eventId,
      studentId: user.id,
      question,
    })
    setBusy(false)
    if (error) {
      setToast?.(error.message || 'Could not send question')
      return
    }
    setToast?.(`Question sent to organizer${eventTitle ? ` · ${eventTitle}` : ''}`)
    setQuestion('')
    if (data) {
      setThread((prev) => [...prev, data])
    } else {
      await loadThread()
    }
  }

  return (
    <div className="es-ask-organizer" data-testid={`ask-organizer-${eventId}`}>
      <button
        type="button"
        className={compact ? 'btn btn-quiet' : 'btn'}
        onClick={() => setOpen((v) => !v)}
        data-testid="button-ask-organizer"
      >
        <MessageCircle size={14} /> Ask Organizer
        {thread.length ? ` (${thread.length})` : ''}
      </button>
      {open ? (
        <div className="es-ask-organizer__panel surface" style={{ marginTop: 10, padding: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Your chat with organizer</div>
          {loadingThread && !thread.length ? (
            <p className="muted" style={{ fontSize: 12 }}>Loading messages…</p>
          ) : null}
          {!loadingThread && !thread.length ? (
            <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              No messages yet. Ask about schedule, venue, or entry.
            </p>
          ) : null}
          {thread.length ? (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 12px',
                maxHeight: 220,
                overflow: 'auto',
                display: 'grid',
                gap: 8,
              }}
            >
              {thread.map((row) => (
                <li key={row.id} className="surface-soft" style={{ padding: 10 }}>
                  <p style={{ fontSize: 12, margin: 0 }}>{row.question}</p>
                  <p className="muted" style={{ fontSize: 10, margin: '4px 0 0' }}>
                    You · {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                  </p>
                  {row.answer ? (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line, rgba(255,255,255,.08))' }}>
                      <div className="eyebrow">Organizer reply</div>
                      <p style={{ fontSize: 12, margin: '4px 0 0' }}>{row.answer}</p>
                    </div>
                  ) : (
                    <p className="muted" style={{ fontSize: 11, margin: '6px 0 0' }}>Waiting for reply…</p>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          <form onSubmit={submit}>
            <label className="label">Your question</label>
            <textarea
              className="input"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about schedule, venue, gear, VIP access…"
              data-testid="input-ask-organizer"
              required
            />
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 10 }}>
              <Send size={14} /> {busy ? 'Sending…' : 'Send to organizer'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
