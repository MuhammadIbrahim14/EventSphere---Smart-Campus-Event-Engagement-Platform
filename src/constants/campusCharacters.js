/**
 * Shared campus character library + resolvers.
 * Admin/organizer can override per event via characterKey / characterUrl / bannerUrl.
 */
export const CAMPUS_CHARACTERS = {
  auto: {
    id: 'auto',
    label: 'Auto (by category)',
    src: '/characters/banner-campus.png',
    alt: 'Auto-selected mascot',
  },
  hero: {
    id: 'hero',
    label: 'Campus explorer',
    src: '/characters/hero-student.png',
    alt: 'Anime student mascot',
  },
  banner: {
    id: 'banner',
    label: 'Featured hype',
    src: '/characters/banner-campus.png',
    alt: 'Campus event banner mascot',
  },
  plane: {
    id: 'plane',
    label: 'Paper plane',
    src: '/characters/plane-accent.png',
    alt: 'Paper plane accent',
  },
  robot: {
    id: 'robot',
    label: 'Tech bot',
    src: '/characters/robot-tech.png',
    alt: 'Friendly tech robot',
  },
  camera: {
    id: 'camera',
    label: 'Photo buddy',
    src: '/characters/camera-photo.png',
    alt: 'Photography mascot',
  },
}

export const CHARACTER_PICKER_OPTIONS = Object.values(CAMPUS_CHARACTERS).filter(
  (c) => c.id !== 'auto',
)

const CATEGORY_RULES = [
  { re: /robot|tech|ai|coding|hack|web|dev|software|program|computer|it\b/i, id: 'robot' },
  { re: /photo|camera|media|film|visual|design|art|creative/i, id: 'camera' },
  { re: /sport|fest|concert|music|culture|social|meetup/i, id: 'hero' },
]

export function characterById(id) {
  if (!id || id === 'auto') return null
  return CAMPUS_CHARACTERS[id] || null
}

/** Resolve mascot for cards / featured overlays. */
export function characterForEvent(event) {
  const customUrl = event?.characterUrl || event?.character_url
  if (customUrl) {
    return {
      id: 'custom',
      label: 'Custom',
      src: customUrl,
      alt: `${event?.title || 'Event'} mascot`,
    }
  }

  const key = event?.characterKey || event?.character_key
  const picked = characterById(key)
  if (picked) return picked

  const hay = `${event?.category || ''} ${event?.title || ''} ${event?.description || ''}`
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(hay)) return CAMPUS_CHARACTERS[rule.id]
  }
  return CAMPUS_CHARACTERS.banner
}

/** Event banner / cover image URL (optional). */
export function bannerForEvent(event) {
  return event?.bannerUrl || event?.banner_url || null
}

export function listCharacterOptions() {
  return [
    { id: '', label: 'Auto (by category)', src: CAMPUS_CHARACTERS.banner.src },
    ...CHARACTER_PICKER_OPTIONS.map((c) => ({
      id: c.id,
      label: c.label,
      src: c.src,
    })),
  ]
}
