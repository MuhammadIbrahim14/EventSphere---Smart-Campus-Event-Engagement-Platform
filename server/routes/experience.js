/**
 * Achievements, Campus Fav, VIP invites, venue maps.
 * Contest/quiz self-score APIs removed from product surface.
 */
import { supabase } from '../../src/lib/supabase.js'
import { TABLES } from '../../src/constants/domain.js'

const ROI_BADGE_IDS = ['first_checkin', 'attended_5', 'feedback_3', 'campus_explorer']

export async function evaluateStudentAchievements(userId) {
  if (!userId) return { data: null, error: { message: 'User required' } }
  const { data, error } = await supabase.rpc('evaluate_student_achievements', {
    p_user_id: userId,
  })
  if (!error) return { data, error: null }

  // Fallback until eventsphere-achievements-roi.sql is applied
  if (!/evaluate_student_achievements|schema cache|function/i.test(error.message || '')) {
    return { data: null, error }
  }

  const [{ count: attendCount }, { count: feedbackCount }, { data: attendRows }] =
    await Promise.all([
      supabase
        .from(TABLES.ATTENDANCE)
        .select('*', { count: 'exact', head: true })
        .eq('student_id', userId)
        .eq('attended', true),
      supabase
        .from(TABLES.FEEDBACK)
        .select('*', { count: 'exact', head: true })
        .eq('student_id', userId),
      supabase
        .from(TABLES.ATTENDANCE)
        .select('event_id, events:event_id ( category )')
        .eq('student_id', userId)
        .eq('attended', true),
    ])

  const categories = new Set(
    (attendRows || [])
      .map((r) => String(r.events?.category || '').trim().toLowerCase())
      .filter(Boolean),
  )

  const awards = []
  if ((attendCount || 0) >= 1) awards.push('first_checkin')
  if ((attendCount || 0) >= 5) awards.push('attended_5')
  if ((feedbackCount || 0) >= 3) awards.push('feedback_3')
  if (categories.size >= 2) awards.push('campus_explorer')

  for (const badgeId of awards) {
    await supabase
      .from(TABLES.USER_BADGES)
      .upsert({ user_id: userId, badge_id: badgeId }, { onConflict: 'user_id,badge_id' })
  }

  const { count: badgeCount } = await supabase
    .from(TABLES.USER_BADGES)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  return {
    data: {
      user_id: userId,
      attend_count: attendCount || 0,
      feedback_count: feedbackCount || 0,
      category_count: categories.size,
      badge_count: badgeCount || 0,
      fav_score:
        (attendCount || 0) * 5 + (feedbackCount || 0) * 3 + (badgeCount || 0) * 20,
    },
    error: null,
  }
}

export async function listCampusFavs(limit = 20) {
  const { data, error } = await supabase.rpc('list_campus_favs', {
    p_limit: limit,
  })
  if (!error) return { data: data || [], error: null }

  if (!/list_campus_favs|schema cache|function/i.test(error.message || '')) {
    return { data: [], error }
  }

  // Soft empty until SQL applied
  return { data: [], error: null }
}

export async function sendVipInvite({ eventId, studentId, invitedBy, note = '' }) {
  if (!eventId || !studentId) {
    return { data: null, error: { message: 'Event and student required' } }
  }

  const { data, error } = await supabase
    .from(TABLES.VIP_INVITES)
    .upsert(
      {
        event_id: eventId,
        student_id: studentId,
        invited_by: invitedBy || null,
        note: note || 'VIP invite for this campus event',
      },
      { onConflict: 'event_id,student_id' },
    )
    .select('*, events:event_id ( title )')
    .maybeSingle()

  if (error) {
    if (/vip_invites|schema cache|does not exist/i.test(error.message || '')) {
      return {
        data: null,
        error: {
          message:
            'VIP invites not set up yet. Run supabase/eventsphere-achievements-roi.sql in Supabase.',
        },
      }
    }
    return { data: null, error }
  }

  const title = data?.events?.title || 'an event'
  await supabase.from(TABLES.STUDENT_NOTICES).insert({
    user_id: studentId,
    event_id: eventId,
    kind: 'vip_invite',
    title: 'You are invited as VIP',
    body: `An organizer invited you as VIP for ${title}. Show this notice at entry.`,
    meta: { vip_invite_id: data?.id },
  })

  return { data, error: null }
}

export async function listVipInvitesForEvent(eventId) {
  const { data, error } = await supabase
    .from(TABLES.VIP_INVITES)
    .select('*, profiles:student_id ( full_name, email )')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function listMyVipInvites(studentId) {
  const { data, error } = await supabase
    .from(TABLES.VIP_INVITES)
    .select('*, events:event_id ( title, event_date, venue )')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function listVenueMaps({ eventId, venueId } = {}) {
  let q = supabase.from(TABLES.VENUE_MAPS).select('*, venue_map_pins(*)')
  if (eventId) q = q.eq('event_id', eventId)
  if (venueId) q = q.eq('venue_id', venueId)
  const { data, error } = await q.order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function createVenueMap(row) {
  const { data, error } = await supabase
    .from(TABLES.VENUE_MAPS)
    .insert({
      venue_id: row.venue_id || null,
      event_id: row.event_id || null,
      title: row.title || 'Floor plan',
      image_url: row.image_url,
    })
    .select('*')
    .single()
  return { data, error }
}

export async function addMapPin(row) {
  const { data, error } = await supabase
    .from(TABLES.VENUE_MAP_PINS)
    .insert({
      map_id: row.map_id,
      label: row.label,
      pin_type: row.pin_type || 'stall',
      x_pct: Number(row.x_pct),
      y_pct: Number(row.y_pct),
    })
    .select('*')
    .single()
  return { data, error }
}

export async function listMyBadges(userId) {
  const { data, error } = await supabase
    .from(TABLES.USER_BADGES)
    .select('*, achievement_badges(*)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })
  return { data: data || [], error }
}

export async function listBadgeCatalog() {
  const { data, error } = await supabase
    .from(TABLES.ACHIEVEMENT_BADGES)
    .select('*')
    .in('id', ROI_BADGE_IDS)
    .order('threshold')
  return { data: data || [], error }
}

export async function getMyAchievementProgress(userId) {
  if (!userId) return { data: null, error: { message: 'User required' } }
  const evalRes = await evaluateStudentAchievements(userId)
  const [badges, catalog, vips] = await Promise.all([
    listMyBadges(userId),
    listBadgeCatalog(),
    listMyVipInvites(userId),
  ])
  return {
    data: {
      stats: evalRes.data,
      badges: badges.data || [],
      catalog: catalog.data || [],
      vipInvites: vips.data || [],
      error: evalRes.error || badges.error || catalog.error || vips.error,
    },
    error: evalRes.error || null,
  }
}

export { ROI_BADGE_IDS }
