/**
 * Promo codes, sponsors, referrals (Phase 4).
 * Event-scoped sponsorship promos expire when registration closes.
 */
import { supabase } from '../../src/lib/supabase.js'
import { TABLES } from '../../src/constants/domain.js'

const PROMO_PUBLIC_SELECT =
  'id, code, discount_type, value, event_id, expires_at, max_uses, used_count, campaign_headline, campaign_blurb, show_on_discover, show_on_event_detail, is_public, active, events:event_id ( id, title, registration_closes_at )'

function remainingPromoUses(promo) {
  if (promo?.max_uses == null) return null
  return Math.max(0, Number(promo.max_uses) - Number(promo.used_count || 0))
}

/** Soft-expire: clock, max uses, or linked event registration closed. */
export function promoSoftExpiredReason(promo, eventRow = null, now = new Date()) {
  if (!promo) return 'Invalid promo code'
  if (promo.active === false) return 'Promo code inactive'
  if (promo.expires_at && new Date(promo.expires_at).getTime() < now.getTime()) {
    return 'Promo code expired'
  }
  if (promo.max_uses != null && Number(promo.used_count || 0) >= Number(promo.max_uses)) {
    return 'Promo code fully redeemed'
  }
  const ev = eventRow || promo.events || null
  const closes = ev?.registration_closes_at || ev?.registrationClosesAt || null
  if (closes && new Date(closes).getTime() < now.getTime()) {
    return 'Promo expired — registration closed for this event'
  }
  return null
}

export async function listPromoCodes() {
  const { data, error } = await supabase
    .from(TABLES.PROMO_CODES)
    .select('*, events:event_id ( id, title, registration_closes_at )')
    .order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function createPromoCode(row) {
  const eventId = row.event_id || null
  let expiresAt = row.expires_at || null

  // Default expiry = event registration close when admin didn't set one
  if (eventId && !expiresAt) {
    const { data: ev } = await supabase
      .from(TABLES.EVENTS)
      .select('registration_closes_at')
      .eq('id', eventId)
      .maybeSingle()
    if (ev?.registration_closes_at) expiresAt = ev.registration_closes_at
  }

  const kind =
    row.campaign_kind ||
    (eventId && row.is_public !== false ? 'sponsorship' : 'standard')

  const baseInsert = {
    code: String(row.code || '').trim().toUpperCase(),
    discount_type: row.discount_type || 'percent',
    value: Number(row.value) || 0,
    max_uses: row.max_uses != null && row.max_uses !== '' ? Number(row.max_uses) : null,
    event_id: eventId,
    active: row.active !== false,
    expires_at: expiresAt,
    is_public: Boolean(row.is_public),
    campaign_headline: row.campaign_headline?.trim() || null,
    campaign_blurb: row.campaign_blurb?.trim() || null,
    show_on_discover: row.show_on_discover !== false,
    show_on_event_detail: row.show_on_event_detail !== false,
  }

  let { data, error } = await supabase
    .from(TABLES.PROMO_CODES)
    .insert({ ...baseInsert, campaign_kind: kind })
    .select('*, events:event_id ( id, title, registration_closes_at )')
    .single()

  // Older DBs before eventsphere-promo-event.sql may lack campaign_kind
  if (error && /campaign_kind/i.test(error.message || '')) {
    ;({ data, error } = await supabase
      .from(TABLES.PROMO_CODES)
      .insert(baseInsert)
      .select('*, events:event_id ( id, title, registration_closes_at )')
      .single())
  }

  return { data, error }
}

/**
 * Public deals for Discover / event detail.
 * Event detail: only promos for that event (not campus-wide on every page).
 * Discover: event-linked sponsorships + campus-wide.
 * Soft-hides when registration closed / sold out / expired.
 */
export async function listPublicPromoCampaigns({ eventId = null, placement = 'discover' } = {}) {
  const { data, error } = await supabase
    .from(TABLES.PROMO_CODES)
    .select(PROMO_PUBLIC_SELECT)
    .eq('active', true)
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error }

  const now = new Date()
  const rows = (data || [])
    .filter((p) => {
      if (promoSoftExpiredReason(p, p.events, now)) return false
      if (placement === 'discover' && p.show_on_discover === false) return false
      if (placement === 'event_detail' && p.show_on_event_detail === false) return false
      if (placement === 'event_detail') {
        if (!eventId) return false
        // Strict: only this event's sponsorship / deal — never bleed campus-wide onto every detail page
        if (!p.event_id || String(p.event_id) !== String(eventId)) return false
      }
      return true
    })
    .map((p) => ({
      ...p,
      campaign_kind: p.campaign_kind || (p.event_id ? 'sponsorship' : 'standard'),
      remaining_uses: remainingPromoUses(p),
      event_title: p.events?.title || null,
      registration_closes_at: p.events?.registration_closes_at || null,
    }))

  return { data: rows, error: null }
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
    .select('*, events:event_id ( id, title, registration_closes_at )')
    .eq('code', normalized)
    .eq('active', true)
    .maybeSingle()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: { message: 'Invalid promo code' } }

  // Event-scoped codes must be used on that event only
  if (data.event_id) {
    if (!eventId) {
      return { data: null, error: { message: 'This code is for a specific event — open that event to apply it' } }
    }
    if (String(data.event_id) !== String(eventId)) {
      return { data: null, error: { message: 'Code not valid for this event' } }
    }
  }

  // Also block when checkout event itself has closed registration
  let checkoutEvent = data.events || null
  if (eventId && (!checkoutEvent || String(checkoutEvent.id) !== String(eventId))) {
    const { data: ev } = await supabase
      .from(TABLES.EVENTS)
      .select('id, title, registration_closes_at')
      .eq('id', eventId)
      .maybeSingle()
    checkoutEvent = ev
  }

  const soft = promoSoftExpiredReason(data, data.events || checkoutEvent)
  if (soft) return { data: null, error: { message: soft } }

  if (checkoutEvent?.registration_closes_at && new Date(checkoutEvent.registration_closes_at) < new Date()) {
    return { data: null, error: { message: 'Registration closed — promo no longer available' } }
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

  return {
    data: {
      ...data,
      remaining_uses: remainingPromoUses(data),
      event_title: data.events?.title || null,
    },
    error: null,
  }
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

export async function listSponsors({ placement, eventId = null } = {}) {
  let q = supabase.from(TABLES.SPONSORS).select('*').eq('active', true).order('sort_order')
  const { data, error } = await q
  if (error) return { data: [], error }

  let rows = data || []

  if (eventId) {
    // Event page: only sponsors tied to this event
    rows = rows.filter((s) => s.event_id && String(s.event_id) === String(eventId))
  } else {
    // Discover / global: campus-wide only (not event-specific)
    rows = rows.filter((s) => !s.event_id)
  }

  if (placement) {
    rows = rows.filter((s) => s.placement === placement || s.placement === 'all')
  }

  return { data: rows, error: null }
}

export async function listAllSponsorsAdmin() {
  const { data, error } = await supabase
    .from(TABLES.SPONSORS)
    .select('*, events:event_id ( id, title )')
    .order('sort_order')
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
      event_id: row.event_id || null,
    })
    .select('*, events:event_id ( id, title )')
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

function randomReferralCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

/** Ensure profile has a referral code (RPC + client fallback for older DBs). */
export async function ensureMyReferralCode(userId) {
  const initial = await getMyReferralCode(userId)
  if (initial.error) return initial
  if (initial.data?.referral_code) return initial

  const { data: rpcRows, error: rpcErr } = await supabase.rpc('ensure_my_referral_code')
  if (!rpcErr && rpcRows) {
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
    if (row?.referral_code) return { data: row, error: null }
  }

  for (let i = 0; i < 6; i += 1) {
    const code = randomReferralCode()
    const { data, error } = await supabase
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', userId)
      .or('referral_code.is.null,referral_code.eq.')
      .select('referral_code, wallet_points')
      .maybeSingle()
    if (!error && data?.referral_code) return { data, error: null }
    if (error && !/unique|duplicate/i.test(String(error.message || ''))) {
      return { data: null, error }
    }
  }

  return getMyReferralCode(userId)
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
