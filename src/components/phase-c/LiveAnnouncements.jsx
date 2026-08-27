import { useEffect, useRef, useState } from 'react'
import { Bell, Plus, Radio, Send } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ANNOUNCEMENT_AUDIENCE, TABLES } from '@/constants/domain'
import { createAnnouncement, listAnnouncements } from '@/services/announcements'
import { listMyNotices, markNoticeRead } from '@/services/studentExperience'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import EsModal from '@/components/shared/EsModal'

function audienceForRole(role) {
  if (role === 'admin') return ANNOUNCEMENT_AUDIENCE.ADMINS
  if (role === 'organizer') return ANNOUNCEMENT_AUDIENCE.ORGANIZERS
  return ANNOUNCEMENT_AUDIENCE.STUDENTS
}

function visibleToRole(row, role) {
  const aud = row?.audience
  if (!aud || aud === ANNOUNCEMENT_AUDIENCE.EVERYONE) return true
  if (role === 'admin') return aud === ANNOUNCEMENT_AUDIENCE.ADMINS || aud === ANNOUNCEMENT_AUDIENCE.EVERYONE
  if (role === 'organizer') {
    return aud === ANNOUNCEMENT_AUDIENCE.ORGANIZERS || aud === ANNOUNCEMENT_AUDIENCE.EVERYONE
  }
  return aud === ANNOUNCEMENT_AUDIENCE.STUDENTS || aud === ANNOUNCEMENT_AUDIENCE.EVERYONE
}

export default function LiveAnnouncements({ role, setToast, canPublish = false }) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [personal, setPersonal] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [live, setLive] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    audience: ANNOUNCEMENT_AUDIENCE.EVERYONE,
  })
  const knownIds = useRef(new Set())

  async function load() {
    setLoading(true)
    const { data, error } = await listAnnouncements({ audience: audienceForRole(role) })
    if (error) setToast?.(error.message)
    const list = data || []
    knownIds.current = new Set(list.map((r) => r.id))
    setRows(list)
    if (role === 'student' || role === 'organizer' || (!canPublish && role)) {
      const { data: notices } = await listMyNotices({ limit: 20 })
      setPersonal(notices || [])
    } else {
      setPersonal([])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    const channel = supabase
      .channel(`announcements-live-${role || 'guest'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.ANNOUNCEMENTS },
        (payload) => {
          const row = payload.new
          if (!row || row.is_published === false) {
            if (payload.eventType === 'DELETE' || payload.old?.id) {
              const id = payload.old?.id || row?.id
              setRows((prev) => prev.filter((r) => r.id !== id))
            }
            return
          }
          if (!visibleToRole(row, role)) return
          setRows((prev) => {
            const without = prev.filter((r) => r.id !== row.id)
            return [row, ...without].sort((a, b) =>
              String(b.published_at || '').localeCompare(String(a.published_at || '')),
            )
          })
          if (payload.eventType === 'INSERT' && row.id && !knownIds.current.has(row.id)) {
            knownIds.current.add(row.id)
            setToast?.(`Live: ${row.title || 'New announcement'}`)
          }
        },
      )
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
      setLive(false)
    }
  }, [role, setToast])

  async function publish() {
    if (!form.title.trim()) {
      setToast?.('Title is required')
      return
    }
    const { error } = await createAnnouncement({
      ...form,
      createdBy: user?.id,
      isPublished: true,
    })
    if (error) {
      setToast?.(error.message)
      return
    }
    setOpen(false)
    setForm({ title: '', body: '', audience: ANNOUNCEMENT_AUDIENCE.EVERYONE })
    setToast?.('Announcement published')
    load()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{canPublish ? 'Broadcast studio' : 'Your signal'}</div>
          <h1>{canPublish ? 'Announcements' : 'Notifications'}</h1>
          <p>
            {canPublish
              ? 'Publish to the campus orbit — listeners update in realtime.'
              : 'Announcements stream live from Supabase Realtime when enabled.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            className={`chip ${live ? 'active' : ''}`}
            aria-live="polite"
            title={live ? 'Realtime connected' : 'Realtime connecting / offline'}
          >
            <Radio size={12} /> {live ? 'Live' : 'Polling'}
          </span>
          {canPublish && (
            <button className="btn btn-primary" type="button" onClick={() => setOpen(true)} data-testid="button-new-announcement">
              <Plus size={15} /> New announcement
            </button>
          )}
        </div>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {!loading && !rows.length && !personal.length && (
        <div className="surface" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>No published announcements yet.</p>
        </div>
      )}

      {!!personal.length && (
        <div className="surface" style={{ padding: '5px 20px', marginBottom: 14 }} role="feed" aria-label="Personal notices">
          <div className="eyebrow" style={{ paddingTop: 14 }}>Personal signals</div>
          {personal.map((n) => (
            <article className="notification-row" key={`n-${n.id}`}>
              <span className="avatar" aria-hidden="true">
                <Bell size={13} />
              </span>
              <div style={{ flex: 1 }}>
                <p>
                  <strong>{n.title}</strong>
                  <br />
                  {n.body}
                </p>
                <time dateTime={n.created_at || undefined}>
                  {n.kind}
                  {' · '}
                  {n.events?.title || 'Event'}
                  {' · '}
                  {n.created_at ? new Date(n.created_at).toLocaleString() : '—'}
                </time>
              </div>
              {!n.read_at && (
                <button
                  className="btn btn-quiet"
                  type="button"
                  onClick={async () => {
                    await markNoticeRead(n.id)
                    load()
                  }}
                >
                  Mark read
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="surface" style={{ padding: '5px 20px' }} role="feed" aria-label="Campus announcements">
        {rows.map((n) => (
          <article className="notification-row" key={n.id}>
            <span className="avatar" aria-hidden="true">
              <Bell size={13} />
            </span>
            <div>
              <p>
                <strong>{n.title}</strong>
                <br />
                {n.body}
              </p>
              <time dateTime={n.published_at || undefined}>
                From: {n.profiles?.full_name || 'Campus staff'}
                {n.profiles?.role ? ` (${n.profiles.role})` : ''}
                {' · '}
                {n.audience}
                {' · '}
                {n.published_at ? new Date(n.published_at).toLocaleString() : '—'}
              </time>
            </div>
          </article>
        ))}
      </div>

      {open && (
        <EsModal title="Publish announcement" onClose={() => setOpen(false)} labelledBy="announcement-dialog-title">
            <div className="form-grid">
              <div className="full">
                <label className="label" htmlFor="announcement-title">Title</label>
                <input
                  id="announcement-title"
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  data-testid="input-announcement-title"
                />
              </div>
              <div className="full">
                <label className="label" htmlFor="announcement-body">Message</label>
                <textarea
                  id="announcement-body"
                  className="input"
                  rows={4}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
              </div>
              <div className="full">
                <label className="label" htmlFor="announcement-audience">Audience</label>
                <select
                  id="announcement-audience"
                  className="input"
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value })}
                >
                  {Object.values(ANNOUNCEMENT_AUDIENCE).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} type="button" onClick={publish}>
              <Send size={14} /> Publish announcement
            </button>
        </EsModal>
      )}
    </>
  )
}
