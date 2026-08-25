/**
 * Social share helpers (Phase D2).
 */

export function eventShareText(event, url) {
  const title = event?.title || 'Campus event'
  const when = [event?.date, event?.time].filter(Boolean).join(' · ')
  const venue = event?.venue || ''
  return [`Join me at ${title}`, when, venue, url].filter(Boolean).join('\n')
}

export function shareLinks(event, url) {
  const text = eventShareText(event, url)
  const encoded = encodeURIComponent(text)
  const encodedUrl = encodeURIComponent(url || '')
  return {
    whatsapp: `https://wa.me/?text=${encoded}`,
    twitter: `https://twitter.com/intent/tweet?text=${encoded}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    copy: url,
  }
}
