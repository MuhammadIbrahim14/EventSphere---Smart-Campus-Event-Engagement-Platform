import { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { ensureMyReferralCode } from '@/services/growth'

/**
 * Student referral orbit code — ensures code exists then displays with copy.
 */
export default function StudentReferralChip({ userId, setToast, compact = false }) {
  const [code, setCode] = useState('')
  const [points, setPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!userId) return undefined
    let alive = true
    ;(async () => {
      setLoading(true)
      const { data, error } = await ensureMyReferralCode(userId)
      if (!alive) return
      if (error) {
        setToast?.(error.message || 'Could not load referral code')
        setLoading(false)
        return
      }
      setCode(data?.referral_code || '')
      setPoints(Number(data?.wallet_points || 0))
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [userId, setToast])

  const onCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setToast?.('Referral code copied')
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setToast?.('Copy failed — select the code manually')
    }
  }

  if (compact) {
    return (
      <div className="es-referral-chip es-referral-chip--compact" data-testid="student-referral-chip">
        <span className="es-referral-chip__label">Your referral code</span>
        <div className="es-referral-chip__row">
          <code className="es-referral-chip__code">{loading ? '…' : code || '—'}</code>
          <button type="button" className="btn btn-quiet" onClick={onCopy} disabled={!code} aria-label="Copy referral code">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="es-referral-chip surface" data-testid="student-referral-panel">
      <div className="eyebrow">Refer a friend</div>
      <h3 className="es-referral-chip__title">Orbit points · {points}</h3>
      <p className="muted" style={{ fontSize: 12, margin: '0 0 12px' }}>
        Share your code — earn +50 points when a friend joins with it.
      </p>
      <label className="label">Your referral code</label>
      <div className="es-referral-chip__row">
        <input className="input" readOnly value={loading ? 'Loading…' : code || 'Unavailable'} data-testid="input-my-referral" />
        <button type="button" className="btn" onClick={onCopy} disabled={!code}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          Copy
        </button>
      </div>
    </div>
  )
}
