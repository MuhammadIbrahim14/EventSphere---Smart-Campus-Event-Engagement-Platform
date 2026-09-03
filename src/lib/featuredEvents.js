import { isEventEnded } from './eventDate'

export function isEventFeatured(event) {
  if (!event) return false
  // Past events never appear in featured spotlights (archive-only)
  if (isEventEnded(event)) return false
  if (!event.isPromoted && !event.is_promoted) return false
  const until = event.promotedUntil || event.promoted_until
  if (!until) return true
  const t = new Date(until).getTime()
  return Number.isFinite(t) && t > Date.now()
}

export function featuredEvents(list = []) {
  return (list || []).filter(isEventFeatured)
}

/** Featured first, then by date ascending. */
export function sortFeaturedFirst(list = []) {
  return [...(list || [])].sort((a, b) => {
    const fa = isEventFeatured(a) ? 1 : 0
    const fb = isEventFeatured(b) ? 1 : 0
    if (fb !== fa) return fb - fa
    return String(a.date || '').localeCompare(String(b.date || ''))
  })
}
