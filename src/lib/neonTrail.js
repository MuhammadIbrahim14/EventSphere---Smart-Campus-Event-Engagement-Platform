/** Shared neon trail config — localStorage today, platform-wide later. */
export const NEON_TRAIL_STORAGE_KEY = 'eventsphere_neon_trail'

export const NEON_TRAIL_PANELS = ['sidebar', 'topbar', 'content']

export const NEON_TRAIL_PANEL_LABELS = {
  sidebar: 'Sidebar',
  topbar: 'Header',
  content: 'Main content',
}

export const DEFAULT_NEON_TRAIL_CONFIG = {
  enabled: true,
  panels: {
    sidebar: {
      enabled: true,
      colors: ['#5ce1ff', '#ffffff', '#ff4fd8'],
      duration: 10,
      reverse: false,
    },
    topbar: {
      enabled: true,
      colors: ['#7dffb3', '#ffffff', '#5ce1ff'],
      duration: 8,
      reverse: true,
    },
    content: {
      enabled: true,
      colors: ['#ff4fd8', '#ffffff', '#7dffb3'],
      duration: 14,
      reverse: false,
    },
  },
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Normalize #rgb / #rrggbb — returns null if invalid. */
export function normalizeHex(value, fallback = '#ffffff') {
  const raw = String(value || '').trim()
  if (!raw) return fallback
  const withHash = raw.startsWith('#') ? raw : `#${raw}`
  if (!HEX_RE.test(withHash)) return fallback
  if (withHash.length === 4) {
    const [, r, g, b] = withHash
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return withHash.toLowerCase()
}

function normalizePanel(panel, fallback) {
  const src = panel || {}
  const fb = fallback || DEFAULT_NEON_TRAIL_CONFIG.panels.sidebar
  const colors = (src.colors || fb.colors).slice(0, 3).map((c, i) => normalizeHex(c, fb.colors[i]))
  while (colors.length < 3) colors.push(fb.colors[colors.length])
  const duration = Math.min(30, Math.max(4, Number(src.duration) || fb.duration))
  return {
    enabled: src.enabled !== false,
    colors,
    duration,
    reverse: Boolean(src.reverse),
  }
}

/** Merge persisted JSON with defaults. */
export function normalizeNeonTrailConfig(raw) {
  const base = DEFAULT_NEON_TRAIL_CONFIG
  if (!raw || typeof raw !== 'object') return structuredClone(base)

  return {
    enabled: raw.enabled !== false,
    panels: {
      sidebar: normalizePanel(raw.panels?.sidebar, base.panels.sidebar),
      topbar: normalizePanel(raw.panels?.topbar, base.panels.topbar),
      content: normalizePanel(raw.panels?.content, base.panels.content),
    },
  }
}

export function loadNeonTrailConfig() {
  try {
    const saved = localStorage.getItem(NEON_TRAIL_STORAGE_KEY)
    if (!saved) return normalizeNeonTrailConfig(null)
    return normalizeNeonTrailConfig(JSON.parse(saved))
  } catch {
    return normalizeNeonTrailConfig(null)
  }
}

export function saveNeonTrailConfig(config) {
  try {
    localStorage.setItem(NEON_TRAIL_STORAGE_KEY, JSON.stringify(normalizeNeonTrailConfig(config)))
  } catch {
    /* ignore quota errors */
  }
}

/** Push trail tokens to :root — consumed by eventsphere-skins.css */
export function applyNeonTrailConfig(config) {
  if (typeof document === 'undefined') return
  const cfg = normalizeNeonTrailConfig(config)
  const root = document.documentElement

  root.dataset.neonTrail = cfg.enabled ? 'on' : 'off'

  NEON_TRAIL_PANELS.forEach((key) => {
    const panel = cfg.panels[key]
    root.dataset[`neon${key.charAt(0).toUpperCase()}${key.slice(1)}`] = panel.enabled && cfg.enabled ? 'on' : 'off'
    root.style.setProperty(`--es-trail-${key}-a`, panel.colors[0])
    root.style.setProperty(`--es-trail-${key}-b`, panel.colors[1])
    root.style.setProperty(`--es-trail-${key}-c`, panel.colors[2])
    root.style.setProperty(`--es-trail-${key}-duration`, `${panel.duration}s`)
    root.style.setProperty(`--es-trail-${key}-direction`, panel.reverse ? 'reverse' : 'normal')
  })
}
