import { CAMPUS_CHARACTERS } from '@/constants/campusCharacters'

function mascotSrc(m) {
  return m?.src || m?.image_url || m?.url || ''
}

function mascotKey(m, i = 0) {
  return m?.id || m?.slug || mascotSrc(m) || `mascot-${i}`
}

function mascotLabel(m) {
  return m?.label || m?.name || m?.slug || 'Campus mascot'
}

/** Resolve library row or fall back to built-in campus character. */
export function resolvePublicMascot(id, library = []) {
  const fromLib = library.find((m) => m.id === id || m.slug === id)
  if (fromLib && mascotSrc(fromLib)) return fromLib
  return CAMPUS_CHARACTERS[id] || CAMPUS_CHARACTERS.hero
}

/**
 * Hero mascot cluster — one lead + orbiting accents (public landing).
 */
export function PublicMascotHero({ library = [] }) {
  const pool = library.length
    ? library.filter((m) => mascotSrc(m))
    : [CAMPUS_CHARACTERS.banner, CAMPUS_CHARACTERS.hero, CAMPUS_CHARACTERS.robot, CAMPUS_CHARACTERS.plane]

  const lead =
    pool.find((m) => m.slug === 'banner' || m.id === 'banner') ||
    pool.find((m) => m.slug === 'hero' || m.id === 'hero') ||
    pool[0]

  const orbit = pool.filter((m) => m !== lead).slice(0, 3)

  if (!lead || !mascotSrc(lead)) return null

  return (
    <div className="es-public-mascot-scene" aria-hidden="true" data-testid="public-mascot-hero">
      <img
        className="es-public-mascot-scene__lead"
        src={mascotSrc(lead)}
        alt=""
        draggable={false}
      />
      {orbit.map((m, i) => (
        <img
          key={mascotKey(m, i)}
          className={`es-public-mascot-scene__orbit es-public-mascot-scene__orbit--${i + 1}`}
          src={mascotSrc(m)}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  )
}

/** Compact mascot for path cards / empty states. */
export function PublicMascotBadge({ mascot, size = 'md', className = '' }) {
  const src = mascotSrc(mascot)
  if (!src) return null
  return (
    <img
      className={`es-public-mascot-badge es-public-mascot-badge--${size} ${className}`.trim()}
      src={src}
      alt={mascotLabel(mascot)}
      draggable={false}
    />
  )
}

/** Empty-state mascot with label. */
export function PublicMascotEmpty({ library = [], message }) {
  const mascot = resolvePublicMascot('hero', library)
  return (
    <div className="es-public-mascot-empty surface">
      <PublicMascotBadge mascot={mascot} size="lg" />
      <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>
        {message}
      </p>
    </div>
  )
}
