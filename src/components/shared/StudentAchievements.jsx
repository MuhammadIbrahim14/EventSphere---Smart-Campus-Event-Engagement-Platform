import { useCallback, useEffect, useState } from 'react'
import { Award, Crown, RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getMyAchievementProgress } from '@/services/experience'

export default function StudentAchievements({ setToast, compact = false }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [badges, setBadges] = useState([])
  const [catalog, setCatalog] = useState([])
  const [vips, setVips] = useState([])

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data, error } = await getMyAchievementProgress(user.id)
    setLoading(false)
    if (error) setToast?.(error.message)
    setStats(data?.stats || null)
    setBadges(data?.badges || [])
    setCatalog(data?.catalog || [])
    setVips(data?.vipInvites || [])
  }, [user?.id, setToast])

  useEffect(() => {
    load()
  }, [load])

  if (!user?.id) return null

  const earned = new Set(badges.map((b) => b.badge_id))

  return (
    <div className="surface" style={{ padding: compact ? 16 : 21 }} data-testid="student-achievements">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div className="eyebrow">Campus Fav track</div>
          <h2 className="display" style={{ margin: '8px 0 0', fontSize: compact ? 18 : 20 }}>
            <Award size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Achievements
          </h2>
        </div>
        <button type="button" className="btn btn-quiet" onClick={load} aria-label="Refresh achievements">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <p className="muted" style={{ marginTop: 12 }}>Loading…</p>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Earn badges by showing up and giving feedback. Top Campus Favs get VIP invites from organizers.
          </p>
          <div className="grid-4" style={{ marginTop: 14, gap: 10 }}>
            <div className="surface-soft" style={{ padding: 12 }}>
              <div className="eyebrow">Fav score</div>
              <strong style={{ fontSize: 22 }}>{stats?.fav_score ?? 0}</strong>
            </div>
            <div className="surface-soft" style={{ padding: 12 }}>
              <div className="eyebrow">Attended</div>
              <strong style={{ fontSize: 22 }}>{stats?.attend_count ?? 0}</strong>
            </div>
            <div className="surface-soft" style={{ padding: 12 }}>
              <div className="eyebrow">Feedback</div>
              <strong style={{ fontSize: 22 }}>{stats?.feedback_count ?? 0}</strong>
            </div>
            <div className="surface-soft" style={{ padding: 12 }}>
              <div className="eyebrow">Badges</div>
              <strong style={{ fontSize: 22 }}>{stats?.badge_count ?? badges.length}</strong>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="eyebrow">Badge collection</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {(catalog.length ? catalog : [
                { id: 'first_checkin', label: 'First Check-in', description: 'Attend 1 event', threshold: 1 },
                { id: 'attended_5', label: 'Campus Regular', description: 'Attend 5 events', threshold: 5 },
                { id: 'feedback_3', label: 'Voice of Campus', description: 'Feedback on 3 events', threshold: 3 },
                { id: 'campus_explorer', label: 'Campus Explorer', description: '2+ categories', threshold: 2 },
              ]).map((b) => {
                const got = earned.has(b.id)
                return (
                  <div
                    key={b.id}
                    className="surface-soft"
                    style={{
                      padding: 12,
                      opacity: got ? 1 : 0.55,
                      border: got ? '1px solid color-mix(in oklab, var(--lime, #b6ef9f) 40%, transparent)' : undefined,
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>{b.label}</strong>
                    <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>
                      {got ? 'Earned' : 'Locked'}
                    </span>
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: 11 }}>{b.description}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {vips.length ? (
            <div style={{ marginTop: 16 }}>
              <div className="eyebrow">
                <Crown size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                VIP invites
              </div>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12 }}>
                {vips.map((v) => (
                  <li key={v.id}>
                    {v.events?.title || 'Event'}
                    {v.events?.event_date ? ` · ${v.events.event_date}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
