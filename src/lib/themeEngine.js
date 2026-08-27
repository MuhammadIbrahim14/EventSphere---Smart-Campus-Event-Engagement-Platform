/**
 * Campus Theme Token Engine — admin-owned brand palette (dark + light).
 * DB (platform_settings.theme_engine) is source of truth; localStorage is cache.
 * Applied as --te-* CSS vars; design system + shell map onto them.
 */
export const THEME_ENGINE_STORAGE_KEY = 'eventsphere_theme_engine'
export const THEME_ENGINE_SETTINGS_KEY = 'theme_engine'

/** Editable hex fields per mode */
export const THEME_PALETTE_KEYS = [
  'ink',
  'panel',
  'text',
  'muted',
  'neon',
  'hot',
  'ice',
  'sun',
  'violet',
  'cyan',
  'pink',
  'lime',
  'danger',
  'orbA',
  'orbB',
  'orbC',
  'stageFrom',
  'stageMid',
  'stageTo',
  'btnFrom',
  'btnTo',
  'btnText',
]

export const THEME_PALETTE_LABELS = {
  ink: 'Page ink / canvas',
  panel: 'Panel surface',
  text: 'Primary text',
  muted: 'Muted text',
  neon: 'Neon accent (lime)',
  hot: 'Hot accent (magenta)',
  ice: 'Ice accent (cyan)',
  sun: 'Sun accent',
  violet: 'Shell violet',
  cyan: 'Shell cyan',
  pink: 'Shell pink',
  lime: 'Shell lime',
  danger: 'Danger / error',
  orbA: 'Stage glow A (hot)',
  orbB: 'Stage glow B (ice)',
  orbC: 'Stage glow C (neon)',
  stageFrom: 'Stage gradient start',
  stageMid: 'Stage gradient mid',
  stageTo: 'Stage gradient end',
  btnFrom: 'Primary button from',
  btnTo: 'Primary button to',
  btnText: 'Primary button text',
}

export const THEME_FIELD_GROUPS = [
  {
    id: 'brand',
    title: 'Brand accents',
    keys: ['neon', 'hot', 'ice', 'sun', 'violet', 'cyan', 'pink', 'lime'],
  },
  {
    id: 'surfaces',
    title: 'Surfaces & type',
    keys: ['ink', 'panel', 'text', 'muted', 'danger'],
  },
  {
    id: 'stage',
    title: 'Main stage background',
    keys: ['orbA', 'orbB', 'orbC', 'stageFrom', 'stageMid', 'stageTo'],
  },
  {
    id: 'buttons',
    title: 'Primary buttons',
    keys: ['btnFrom', 'btnTo', 'btnText'],
  },
]

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

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

function hexToRgb(hex) {
  const h = normalizeHex(hex, '#000000').slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  const lin = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/** WCAG contrast ratio between two hex colors */
export function contrastRatio(a, b) {
  const L1 = relativeLuminance(a)
  const L2 = relativeLuminance(b)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function paletteContrastWarnings(palette) {
  const warnings = []
  const textOnInk = contrastRatio(palette.text, palette.ink)
  if (textOnInk < 4.5) {
    warnings.push(`Text on page ink is low contrast (${textOnInk.toFixed(1)}:1)`)
  }
  const btn = contrastRatio(palette.btnText, palette.btnFrom)
  if (btn < 3) {
    warnings.push(`Button text vs button start is low contrast (${btn.toFixed(1)}:1)`)
  }
  return warnings
}

export const DEFAULT_DARK_PALETTE = {
  ink: '#07060c',
  panel: '#12101c',
  text: '#f6f3ff',
  muted: '#9a94b8',
  neon: '#7dffb3',
  hot: '#ff4fd8',
  ice: '#5ce1ff',
  sun: '#ffe56a',
  violet: '#9a7bff',
  cyan: '#54d8e8',
  pink: '#e579d2',
  lime: '#b6ef9f',
  danger: '#ff778d',
  orbA: '#ff4fd8',
  orbB: '#5ce1ff',
  orbC: '#7dffb3',
  stageFrom: '#0b0a14',
  stageMid: '#12101c',
  stageTo: '#0a1218',
  btnFrom: '#7dffb3',
  btnTo: '#5ce1ff',
  btnText: '#07060c',
}

export const DEFAULT_LIGHT_PALETTE = {
  ink: '#f4f1ea',
  panel: '#ffffff',
  text: '#14122a',
  muted: '#66708c',
  neon: '#0f9f6e',
  hot: '#d12ea8',
  ice: '#0891b2',
  sun: '#c27803',
  violet: '#7c5cbf',
  cyan: '#0891b2',
  pink: '#d12ea8',
  lime: '#0f9f6e',
  danger: '#dc2626',
  orbA: '#d12ea8',
  orbB: '#0891b2',
  orbC: '#0f9f6e',
  stageFrom: '#f7f4ee',
  stageMid: '#eef3f8',
  stageTo: '#f8eef5',
  btnFrom: '#0891b2',
  btnTo: '#d12ea8',
  btnText: '#ffffff',
}

export const THEME_PRESETS = {
  midnight: {
    id: 'midnight',
    label: 'Midnight Campus',
    dark: structuredClone(DEFAULT_DARK_PALETTE),
    light: structuredClone(DEFAULT_LIGHT_PALETTE),
  },
  'campus-blue': {
    id: 'campus-blue',
    label: 'Campus Blue',
    dark: {
      ...DEFAULT_DARK_PALETTE,
      neon: '#5eead4',
      hot: '#38bdf8',
      ice: '#22d3ee',
      violet: '#60a5fa',
      cyan: '#22d3ee',
      pink: '#7dd3fc',
      orbA: '#38bdf8',
      orbB: '#22d3ee',
      orbC: '#5eead4',
      stageFrom: '#070b14',
      stageMid: '#0c1524',
      stageTo: '#071018',
      btnFrom: '#22d3ee',
      btnTo: '#60a5fa',
      btnText: '#07060c',
    },
    light: {
      ...DEFAULT_LIGHT_PALETTE,
      neon: '#0f766e',
      hot: '#0284c7',
      ice: '#0369a1',
      violet: '#2563eb',
      cyan: '#0284c7',
      pink: '#0ea5e9',
      orbA: '#0284c7',
      orbB: '#0369a1',
      orbC: '#0f766e',
      stageFrom: '#f0f7fb',
      stageMid: '#e8f1f8',
      stageTo: '#eef6f4',
      btnFrom: '#0284c7',
      btnTo: '#2563eb',
      btnText: '#ffffff',
    },
  },
  festival: {
    id: 'festival',
    label: 'Festival Hot',
    dark: {
      ...DEFAULT_DARK_PALETTE,
      neon: '#fbbf24',
      hot: '#f472b6',
      ice: '#c084fc',
      violet: '#a78bfa',
      cyan: '#f0abfc',
      pink: '#fb7185',
      lime: '#fde047',
      orbA: '#f472b6',
      orbB: '#c084fc',
      orbC: '#fbbf24',
      stageFrom: '#120810',
      stageMid: '#1a0f1c',
      stageTo: '#140a12',
      btnFrom: '#f472b6',
      btnTo: '#c084fc',
      btnText: '#120810',
    },
    light: {
      ...DEFAULT_LIGHT_PALETTE,
      neon: '#b45309',
      hot: '#db2777',
      ice: '#7c3aed',
      violet: '#7c3aed',
      cyan: '#a21caf',
      pink: '#db2777',
      lime: '#ca8a04',
      orbA: '#db2777',
      orbB: '#7c3aed',
      orbC: '#b45309',
      stageFrom: '#fff7ed',
      stageMid: '#fdf2f8',
      stageTo: '#f5f3ff',
      btnFrom: '#db2777',
      btnTo: '#7c3aed',
      btnText: '#ffffff',
    },
  },
}

export const DEFAULT_THEME_ENGINE = {
  version: 1,
  preset: 'midnight',
  dark: structuredClone(DEFAULT_DARK_PALETTE),
  light: structuredClone(DEFAULT_LIGHT_PALETTE),
}

function normalizePalette(raw, fallback) {
  const out = { ...fallback }
  if (!raw || typeof raw !== 'object') return out
  for (const key of THEME_PALETTE_KEYS) {
    out[key] = normalizeHex(raw[key], fallback[key])
  }
  return out
}

export function normalizeThemeEngine(raw) {
  if (!raw || typeof raw !== 'object') {
    return structuredClone(DEFAULT_THEME_ENGINE)
  }
  const preset =
    raw.preset && THEME_PRESETS[raw.preset] ? raw.preset : 'custom'
  return {
    version: 1,
    preset,
    dark: normalizePalette(raw.dark, DEFAULT_DARK_PALETTE),
    light: normalizePalette(raw.light, DEFAULT_LIGHT_PALETTE),
  }
}

export function themeFromPreset(presetId) {
  const pack = THEME_PRESETS[presetId]
  if (!pack) return structuredClone(DEFAULT_THEME_ENGINE)
  return normalizeThemeEngine({
    version: 1,
    preset: pack.id,
    dark: pack.dark,
    light: pack.light,
  })
}

export function loadThemeEngine() {
  try {
    const saved = localStorage.getItem(THEME_ENGINE_STORAGE_KEY)
    if (!saved) return normalizeThemeEngine(null)
    return normalizeThemeEngine(JSON.parse(saved))
  } catch {
    return normalizeThemeEngine(null)
  }
}

export function saveThemeEngineLocal(config) {
  try {
    localStorage.setItem(
      THEME_ENGINE_STORAGE_KEY,
      JSON.stringify(normalizeThemeEngine(config)),
    )
  } catch {
    /* ignore */
  }
}

/**
 * Push both dark + light token maps onto :root.
 * CSS maps --te-* / --te-*-light into --es-* and shell vars under :root / html.light.
 */
export function applyThemeEngine(config) {
  if (typeof document === 'undefined') return
  const cfg = normalizeThemeEngine(config)
  const root = document.documentElement

  THEME_PALETTE_KEYS.forEach((key) => {
    root.style.setProperty(`--te-${key}`, cfg.dark[key])
    root.style.setProperty(`--te-${key}-light`, cfg.light[key])
  })

  root.dataset.themeEngine = cfg.preset || 'custom'
}
