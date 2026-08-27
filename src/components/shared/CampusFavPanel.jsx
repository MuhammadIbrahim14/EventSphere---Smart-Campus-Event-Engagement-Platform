import { useCallback, useEffect, useState } from 'react'
import { Crown, Sparkles, Star } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { listCampusFavs, listVipInvitesForEvent, sendVipInvite } from '@/services/experience'

export default function CampusFavPanel({ eventId, eventTitle, canManage = false, setToast }) {
  const { user } = useAuth()
  const [favs, setFavs] = useState([])
  const [invited, setInvited] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [favRes, vipRes] = await Promise.all([
      listCampusFavs(15),
      eventId ? listVipInvitesForEvent(eventId) : Promise.resolve({ data: [] }),
    ])
    if (favRes.error) setToast?.(favRes.error.message)
    setFavs(favRes.data || [])
    setInvited(new Set((vipRes.data || []).map((r) => r.student_id)))
    setLoading(false)
  }, [canManage, eventId, setToast])

  useEffect(() => {
    load()
  }, [load])

  if (!canManage || !eventId) return null

  const invite = async (row) => {
    setBusyId(row.user_id)
    const { error } = await sendVipInvite({
      eventId,
      studentId: row.user_id,
      invitedBy: user?.id,
      note: `VIP for ${eventTitle || 'this event'}`,
    })
    setBusyId(null)
    if (error) {
      setToast?.(error.message)
      return
    }
    setToast?.(`VIP invite sent to ${row.full_name || 'student'}`)
    setInvited((prev) => new Set([...prev, row.user_id]))
  }

  return (
    <div className="surface" style={{ padding: 18, marginTop: 16 }} data-testid="campus-fav-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Crown size={18} style={{ color: 'var(--es-sun, #ffca7f)' }} />
        <div>
          <div className="eyebrow">Campus Fav → VIP</div>
          <h3 className="display" style={{ margin: 0, fontSize: 18 }}>Invite standout students</h3>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Ranked by real activity: attendance, feedback, and earned badges — not self-scored quizzes.
      </p>

      {loading ? (
        <p className="muted" style={{ marginTop: 12 }}>Loading Campus Favs…</p>
      ) : !favs.length ? (
        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          No Campus Fav scores yet. Mark attendance and collect feedback — badges unlock automatically.
          Run <code>eventsphere-achievements-roi.sql</code> if this stays empty.
        </p>
      ) : (
        <ol className="es-leaderboard" style={{ marginTop: 14 }}>
          {favs.map((row, i) => {
            const isVip = invited.has(row.user_id)
            return (
              <li key={row.user_id} style={{ alignItems: 'flex-start' }}>
                <span className="es-leaderboard__rank">#{i + 1}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong>{row.full_name || 'Student'}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{row.email || '—'}</div>
                  <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>
                    {row.attend_count || 0} attended · {row.feedback_count || 0} feedback ·{' '}
                    {row.badge_count || 0} badges
                  </div>
                </div>
                <span className="es-leaderboard__score" style={{ marginRight: 8 }}>
                  <Star size={12} style={{ verticalAlign: 'middle' }} /> {row.fav_score || 0}
                </span>
                <button
                  type="button"
                  className={`btn ${isVip ? 'btn-quiet' : 'btn-primary'}`}
                  style={{ fontSize: 11, padding: '6px 10px' }}
                  disabled={isVip || busyId === row.user_id}
                  onClick={() => invite(row)}
                >
                  <Sparkles size={12} /> {isVip ? 'VIP invited' : busyId === row.user_id ? '…' : 'VIP invite'}
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
