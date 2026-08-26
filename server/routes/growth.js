/**
 * Promo codes, sponsors, referrals (Phase 4).
 */
import { supabase } from '../../src/lib/supabase.js'
import { TABLES } from '../../src/constants/domain.js'

export async function listPromoCodes() {
  const { data, error } = await supabase
    .from(TABLES.PROMO_CODES)
    .select('*')
    .order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function createPromoCode(row) {
  const { data, error } = await supabase
    .from(TABLES.PROMO_CODES)
    .insert({
      code: String(row.code || '').trim().toUpperCase(),
      discount_type: row.discount_type || 'percent',
      value: Number(row.value) || 0,
      max_uses: row.max_uses != null ? Number(row.max_uses) : null,
      event_id: row.event_id || null,
      active: row.active !== false,
      expires_at: row.expires_at || null,
    })
    .select('*')
    .single()
  return { data, error }
}

export async function updatePromoCode(id, patch) {
  const { data, error } = await supabase
    .from(TABLES.PROMO_CODES)
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  return { data, error }
}

export async function validatePromoCode(code, { eventId, studentId } = {}) {
  const normalized = String(code || '').trim().toUpperCase()
  if (!normalized) return { data: null, error: { message: 'Enter a promo code' } }

  const { data, error } = await supabase
    .from(TABLES.PROMO_CODES)
    .select('*')
    .eq('code', normalized)
    .eq('active', true)
    .maybeSingle()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: { message: 'Invalid promo code' } }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { data: null, error: { message: 'Promo code expired' } }
  }
  if (data.max_uses != null && data.used_count >= data.max_uses) {
    return { data: null, error: { message: 'Promo code fully redeemed' } }
  }
  if (data.event_id && eventId && data.event_id !== eventId) {
    return { data: null, error: { message: 'Code not valid for this event' } }
  }

  if (studentId) {
    const { data: prior } = await supabase
      .from(TABLES.PROMO_REDEMPTIONS)
      .select('id')
      .eq('promo_id', data.id)
      .eq('student_id', studentId)
      .maybeSingle()
    if (prior) return { data: null, error: { message: 'You already used this code' } }
  }

  return { data, error: null }
}

export function applyPromoDiscount(amount, promo) {
  const base = Number(amount) || 0
  if (!promo) return base
  if (promo.discount_type === 'percent') {
    return Math.max(0, +(base * (1 - Number(promo.value) / 100)).toFixed(2))
  }
  return Math.max(0, +(base - Number(promo.value)).toFixed(2))
}

export async function redeemPromo({ promoId, studentId, eventId, registrationId }) {
  const { error: redErr } = await supabase.from(TABLES.PROMO_REDEMPTIONS).insert({
    promo_id: promoId,
    student_id: studentId,
    event_id: eventId || null,
    registration_id: registrationId || null,
  })
  if (redErr) return { error: redErr }

  const { data: promo } = await supabase.from(TABLES.PROMO_CODES).select('used_count').eq('id', promoId).maybeSingle()
  await supabase
    .from(TABLES.PROMO_CODES)
    .update({ used_count: (promo?.used_count || 0) + 1 })
    .eq('id', promoId)

  return { error: null }
}

export async function listSponsors({ placement } = {}) {
  let q = supabase.from(TABLES.SPONSORS).select('*').eq('active', true).order('sort_order')
  const { data, error } = await q
  let rows = data || []
  if (placement) {
    rows = rows.filter((s) => s.placement === placement || s.placement === 'all')
  }
  return { data: rows, error }
}

export async function listAllSponsorsAdmin() {
  const { data, error } = await supabase.from(TABLES.SPONSORS).select('*').order('sort_order')
  return { data: data || [], error }
}

export async function createSponsor(row) {
  const { data, error } = await supabase
    .from(TABLES.SPONSORS)
    .insert({
      name: row.name,
      logo_url: row.logo_url,
      link_url: row.link_url || null,
      placement: row.placement || 'all',
      sort_order: Number(row.sort_order) || 0,
      active: row.active !== false,
    })
    .select('*')
    .single()
  return { data, error }
}

export async function updateSponsor(id, patch) {
  const { data, error } = await supabase.from(TABLES.SPONSORS).update(patch).eq('id', id).select('*').single()
  return { data, error }
}

export async function deleteSponsor(id) {
  const { error } = await supabase.from(TABLES.SPONSORS).delete().eq('id', id)
  return { error }
}

export async function getMyReferralCode(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('referral_code, wallet_points')
    .eq('id', userId)
    .maybeSingle()
  return { data, error }
}

export async function applyReferralCode(referredId, code) {
  const normalized = String(code || '').trim().toUpperCase()
  if (!normalized) return { error: { message: 'Enter a referral code' } }

  const { data: referrer, error: findErr } = await supabase
    .from('profiles')
    .select('id, wallet_points')
    .eq('referral_code', normalized)
    .maybeSingle()
  if (findErr) return { error: findErr }
  if (!referrer) return { error: { message: 'Invalid referral code' } }
  if (referrer.id === referredId) return { error: { message: 'Cannot refer yourself' } }

  const { error } = await supabase.from(TABLES.REFERRALS).insert({
    referrer_id: referrer.id,
    referred_id: referredId,
    points_awarded: 50,
  })
  if (error) return { error }

  await supabase
    .from('profiles')
    .update({ wallet_points: (referrer.wallet_points || 0) + 50 })
    .eq('id', referrer.id)

  await supabase.from(TABLES.STUDENT_NOTICES).insert({
    user_id: referrer.id,
    kind: 'referral_reward',
    title: 'Referral reward',
    body: 'A friend joined with your code — +50 orbit points!',
    meta: { referred_id: referredId },
  })

  return { error: null }
}
