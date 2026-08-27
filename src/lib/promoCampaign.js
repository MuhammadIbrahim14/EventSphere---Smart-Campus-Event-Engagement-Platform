/**
 * Client helpers for public promo / sponsorship campaigns (copy → checkout).
 */

export const PROMO_STASH_KEY = 'es_promo_code'

export function stashPromoCode(code) {
  const c = String(code || '').trim().toUpperCase()
  if (!c) return
  try {
    sessionStorage.setItem(PROMO_STASH_KEY, c)
  } catch {
    /* ignore */
  }
}

export function peekPromoCode() {
  try {
    const c = sessionStorage.getItem(PROMO_STASH_KEY)
    return c ? String(c).trim().toUpperCase() : ''
  } catch {
    return ''
  }
}

export function clearPromoCode() {
  try {
    sessionStorage.removeItem(PROMO_STASH_KEY)
  } catch {
    /* ignore */
  }
}

export function formatPromoValue(promo) {
  if (!promo) return ''
  if (promo.discount_type === 'percent') return `${promo.value}% off fees`
  return `$${Number(promo.value || 0).toFixed(2)} off fees`
}

export function campaignTitle(promo) {
  if (promo?.campaign_headline?.trim()) return promo.campaign_headline.trim()
  return `${promo?.code || 'DEAL'} · ${formatPromoValue(promo)}`
}

export function isSponsorshipPromo(promo) {
  return (
    promo?.campaign_kind === 'sponsorship' ||
    Boolean(promo?.event_id)
  )
}

export function remainingSeatsLabel(promo) {
  const rem =
    promo?.remaining_uses != null
      ? promo.remaining_uses
      : promo?.max_uses != null
        ? Math.max(0, Number(promo.max_uses) - Number(promo.used_count || 0))
        : null
  if (rem == null) return null
  if (rem <= 0) return 'No sponsored seats left'
  if (rem === 1) return '1 sponsored seat left'
  return `${rem} of ${promo.max_uses} sponsored seats left`
}

export async function copyPromoToClipboard(code) {
  const c = String(code || '').trim().toUpperCase()
  if (!c) return { ok: false }
  // Clipboard only — checkout must never autofill; user pastes / types + Apply
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(c)
      return { ok: true, code: c }
    }
  } catch {
    /* fall through */
  }
  return { ok: true, code: c, clipboard: false }
}
