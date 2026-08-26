/**
 * Organizer Ask inbox — WhatsApp-style chat list + conversation history.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, MessageCircle, Search, Send } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { EsPageChrome } from '@/components/design-system'
import { listOrganizerQuestions, replyToQuestion } from '@/services/questions'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

function threadKey(row) {
  return `${row.student_id}::${row.event_id}`
}

function initials(name, email) {
  const src = String(name || email || '?').trim()
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

function buildThreads(rows) {
  const map = new Map()
  for (const row of rows || []) {
    const key = threadKey(row)
    if (!map.has(key)) {
      map.set(key, {
        key,
        studentId: row.student_id,
        eventId: row.event_id,
        eventTitle: row.events?.title || 'Event',
        name: row.profiles?.full_name || 'Student',
        email: row.profiles?.email || '',
        messages: [],
      })
    }
    const t = map.get(key)
    if (row.profiles?.full_name) t.name = row.profiles.full_name
    if (row.profiles?.email) t.email = row.profiles.email
    if (row.events?.title) t.eventTitle = row.events.title
    t.messages.push(row)
  }

  const threads = [...map.values()].map((t) => {
    const messages = [...t.messages].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at),
    )
    const last = messages[messages.length - 1]
    const unanswered = messages.filter((m) => !m.answer).length
    const preview = last?.answer
      ? `You: ${last.answer}`
      : last?.question || ''
    const lastAt = last?.answered_at || last?.created_at
    return {
      ...t,
      messages,
      unanswered,
      preview,
      lastAt,
    }
  })

  threads.sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0))
  return threads
}

export default function OrganizerQuestionsInbox({ events = [], setToast }) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeKey, setActiveKey] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [mobileChat, setMobileChat] = useState(false)
  const scrollerRef = useRef(null)

  const myEventIds = useMemo(() => {
    if (!user?.id) return []
    return (events || [])
      .filter((e) => e.organizerId === user.id || e.organizer_id === user.id)
      .map((e) => e.id)
      .filter(Boolean)
  }, [events, user?.id])

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await listOrganizerQuestions(myEventIds, user.id)
    if (error) setToast?.(error.message)
    setRows(data || [])
    setLoading(false)
  }, [myEventIds, user?.id, setToast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return undefined
    const channel = supabase
      .channel(`org-questions-chat-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_questions' },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, load])

  const threads = useMemo(() => buildThreads(rows), [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return threads
    return threads.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.eventTitle.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q),
    )
  }, [threads, query])

  const active = useMemo(
    () => threads.find((t) => t.key === activeKey) || null,
    [threads, activeKey],
  )

  useEffect(() => {
    if (activeKey && !threads.some((t) => t.key === activeKey)) {
      setActiveKey(null)
      setMobileChat(false)
    }
  }, [threads, activeKey])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !active) return
    el.scrollTop = el.scrollHeight
  }, [active])

  const openChat = (key) => {
    setActiveKey(key)
    setDraft('')
    setMobileChat(true)
  }

  const closeChat = () => {
    setMobileChat(false)
  }

  const replyTarget = active?.messages?.filter((m) => !m.answer).slice(-1)[0] || null

  const sendReply = async (e) => {
    e?.preventDefault?.()
    if (!active || !replyTarget || !draft.trim()) return
    setBusy(true)
    const { error } = await replyToQuestion({
      questionId: replyTarget.id,
      answer: draft,
      answeredBy: user?.id,
      studentId: active.studentId,
      eventTitle: active.eventTitle,
    })
    setBusy(false)
    if (error) {
      setToast?.(error.message)
      return
    }
    setDraft('')
    setToast?.('Reply sent')
    await load()
  }

  return (
    <>
      <EsPageChrome
        eyebrow="Student chats"
        title="Ask Organizer"
        description="WhatsApp-style inbox — open a student to see full history, then reply in the thread."
      />

      {loading ? (
        <p className="muted">Loading chats…</p>
      ) : !threads.length ? (
        <div className="surface empty">
          <MessageCircle size={22} />
          <h3>No chats yet</h3>
          <p className="muted">When students ask a question, their chat appears here with name and email.</p>
          <button type="button" className="btn" style={{ marginTop: 12 }} onClick={load}>
            Refresh
          </button>
        </div>
      ) : (
        <div className={`es-org-chat ${mobileChat ? 'es-org-chat--mobile-open' : ''}`}>
          <aside className="es-org-chat__list surface">
            <div className="es-org-chat__list-head">
              <h2>Chats</h2>
              <div className="es-org-chat__search">
                <Search size={14} />
                <input
                  className="input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or email…"
                  aria-label="Search chats"
                />
              </div>
            </div>
            <ul className="es-org-chat__contacts">
              {filtered.map((t) => {
                const selected = t.key === activeKey
                return (
                  <li key={t.key}>
                    <button
                      type="button"
                      className={`es-org-chat__contact ${selected ? 'is-active' : ''}`}
                      onClick={() => openChat(t.key)}
                    >
                      <span className="es-org-chat__avatar" aria-hidden>
                        {initials(t.name, t.email)}
                      </span>
                      <span className="es-org-chat__meta">
                        <span className="es-org-chat__name-row">
                          <strong>{t.name}</strong>
                          <time>
                            {t.lastAt
                              ? new Date(t.lastAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </time>
                        </span>
                        <span className="es-org-chat__email">{t.email || 'No email'}</span>
                        <span className="es-org-chat__preview">
                          <span className="es-org-chat__event">{t.eventTitle}</span>
                          {' · '}
                          {t.preview.slice(0, 64)}
                          {t.preview.length > 64 ? '…' : ''}
                        </span>
                      </span>
                      {t.unanswered > 0 ? (
                        <span className="es-org-chat__badge">{t.unanswered}</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
              {!filtered.length ? (
                <li className="muted" style={{ padding: 16, fontSize: 13 }}>
                  No chats match your search.
                </li>
              ) : null}
            </ul>
          </aside>

          <section className="es-org-chat__panel surface">
            {!active ? (
              <div className="es-org-chat__empty">
                <MessageCircle size={28} />
                <h3>Select a chat</h3>
                <p className="muted">Pick a student on the left to open their message history.</p>
              </div>
            ) : (
              <>
                <header className="es-org-chat__header">
                  <button
                    type="button"
                    className="icon-btn es-org-chat__back"
                    onClick={closeChat}
                    aria-label="Back to chats"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <span className="es-org-chat__avatar" aria-hidden>
                    {initials(active.name, active.email)}
                  </span>
                  <div className="es-org-chat__header-text">
                    <strong>{active.name}</strong>
                    <span className="muted">{active.email || 'No email on profile'}</span>
                    <span className="eyebrow">{active.eventTitle}</span>
                  </div>
                </header>

                <div className="es-org-chat__messages" ref={scrollerRef}>
                  {active.messages.map((m) => (
                    <div key={m.id} className="es-org-chat__turn">
                      <div className="es-org-chat__bubble es-org-chat__bubble--in">
                        <p>{m.question}</p>
                        <time>
                          {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                        </time>
                      </div>
                      {m.answer ? (
                        <div className="es-org-chat__bubble es-org-chat__bubble--out">
                          <p>{m.answer}</p>
                          <time>
                            {m.answered_at
                              ? new Date(m.answered_at).toLocaleString()
                              : 'Replied'}
                          </time>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <form className="es-org-chat__composer" onSubmit={sendReply}>
                  {replyTarget ? (
                    <>
                      <input
                        className="input"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={`Reply to ${active.name}…`}
                        disabled={busy}
                        data-testid="input-org-chat-reply"
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={busy || !draft.trim()}
                        aria-label="Send reply"
                      >
                        <Send size={15} />
                      </button>
                    </>
                  ) : (
                    <p className="muted" style={{ margin: 0, fontSize: 12, padding: '8px 4px' }}>
                      Waiting for the next question from {active.name}. All messages in this chat are answered.
                    </p>
                  )}
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </>
  )
}
