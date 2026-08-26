/**
 * Interest preferences + Recommended for You scoring.
 */
import { INTEREST_CATEGORY_MAP, STUDENT_INTERESTS } from '@/constants/domain'
import { supabase } from '@/lib/supabase'
import { EVENT_STATUS } from '@/constants/domain'

export { STUDENT_INTERESTS }

export function getProfileInterests(profile) {
  const raw = profile?.preferences?.interests
  if (Array.isArray(raw)) return raw.filter((x) => STUDENT_INTERESTS.includes(x))
  return []
}

export async function saveProfileInterests(userId, interests) {
  if (!userId) return { error: { message: 'Not signed in' } }
  const cleaned = (interests || []).filter((x) => STUDENT_INTERESTS.includes(x))

  const { data: existing, error: readErr } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle()
  if (readErr) return { data: null, error: readErr }

  const preferences = {
    ...(existing?.preferences || {}),
    interests: cleaned,
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ preferences })
    .eq('id', userId)
    .select('preferences')
    .single()

  return { data: data?.preferences?.interests || cleaned, error }
}

/**
 * Score approved events by interest overlap; exclude already registered.
 */
export function getRecommendedEvents(events = [], { interests = [], registrations = [], limit = 6 } = {}) {
  const regSet = new Set((registrations || []).map(String))
  const interestSet = new Set(interests || [])
  const preferredCategories = new Set()
  interestSet.forEach((interest) => {
    ;(INTEREST_CATEGORY_MAP[interest] || []).forEach((c) => preferredCategories.add(c.toLowerCase()))
  })

  const scored = (events || [])
    .filter((e) => {
      const status = String(e.status || '').toLowerCase()
      const ok =
        status === 'approved' ||
        status === EVENT_STATUS.APPROVED ||
        e.status === 'Approved'
      return ok && !regSet.has(String(e.id))
    })
    .map((e) => {
      let score = 0
      const cat = String(e.category || '').toLowerCase()
      const title = `${e.title || ''} ${e.description || ''}`.toLowerCase()
      if (preferredCategories.has(cat)) score += 10
      interestSet.forEach((interest) => {
        if (title.includes(String(interest).toLowerCase())) score += 4
        if (cat.includes(String(interest).toLowerCase())) score += 3
      })
      if (e.is_promoted || e.isPromoted) score += 5
      // Slight bump for sooner dates
      if (e.date) score += 1
      return { event: e, score }
    })
    .filter((row) => row.score > 0 || interestSet.size === 0)
    .sort((a, b) => b.score - a.score || String(a.event.date).localeCompare(String(b.event.date)))

  // If no interests, fall back to soonest approved
  if (!interestSet.size) {
    return (events || [])
      .filter((e) => {
        const status = String(e.status || '').toLowerCase()
        return (
          (status === 'approved' || e.status === 'Approved') &&
          !regSet.has(String(e.id))
        )
      })
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, limit)
  }

  return scored.slice(0, limit).map((r) => r.event)
}
