import { CAMPUS_CHARACTERS, characterById } from '@/constants/campusCharacters'

/** Local cache mirror while offline / before Supabase sync */
export const STUDENT_MASCOT_STORAGE_KEY = 'eventsphere_student_mascot_by_user'

export const DEFAULT_STUDENT_MASCOT = {
  source: 'library',
  mascotId: 'hero',
  customUrl: null,
  showAccent: true,
}

/** Legacy built-in ids when DB library unavailable */
export const STUDENT_HERO_MASCOT_IDS = ['hero', 'banner', 'robot', 'camera']

export function listStudentHeroMascots() {
  return STUDENT_HERO_MASCOT_IDS.map((id) => CAMPUS_CHARACTERS[id]).filter(Boolean)
}

function libraryIds(library) {
  if (library?.length) return library.map((m) => m.id || m.slug).filter(Boolean)
  return STUDENT_HERO_MASCOT_IDS
}

/** Upgrade old { heroId } localStorage shape. */
export function migrateLegacyStudentMascot(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.source || raw.mascotId || raw.customUrl) return raw
  if (raw.heroId) {
    return {
      source: 'library',
      mascotId: raw.heroId,
      customUrl: null,
      showAccent: raw.showAccent !== false,
    }
  }
  return null
}

export function normalizeStudentMascot(raw, library = []) {
  const migrated = migrateLegacyStudentMascot(raw) || raw
  const allowed = libraryIds(library)
  const base = DEFAULT_STUDENT_MASCOT

  let customUrl =
    migrated?.source === 'custom' && migrated?.customUrl
      ? String(migrated.customUrl).trim()
      : null

  if (customUrl) {
    return {
      source: 'custom',
      mascotId: 'custom',
      customUrl,
      showAccent: migrated?.showAccent !== false,
    }
  }

  let mascotId = migrated?.mascotId || migrated?.heroId || base.mascotId
  if (!allowed.includes(mascotId)) mascotId = allowed[0] || base.mascotId

  return {
    source: 'library',
    mascotId,
    customUrl: null,
    showAccent: migrated?.showAccent !== false,
  }
}

function readStore() {
  try {
    const raw = localStorage.getItem(STUDENT_MASCOT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STUDENT_MASCOT_STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

export function loadStudentMascotLocal(userId, library = []) {
  if (!userId) return normalizeStudentMascot(null, library)
  const store = readStore()
  return normalizeStudentMascot(store[userId], library)
}

export function saveStudentMascotLocal(userId, config, library = []) {
  if (!userId) return
  const store = readStore()
  store[userId] = normalizeStudentMascot(config, library)
  writeStore(store)
}

export function resolveStudentHeroMascot(config, library = []) {
  const normalized = normalizeStudentMascot(config, library)

  if (normalized.source === 'custom' && normalized.customUrl) {
    return {
      id: 'custom',
      slug: 'custom',
      label: 'Your mascot',
      src: normalized.customUrl,
    }
  }

  const match = library.find(
    (m) => m.id === normalized.mascotId || m.slug === normalized.mascotId,
  )
  if (match) {
    return {
      id: match.id || match.slug,
      slug: match.slug || match.id,
      label: match.label,
      src: match.src || match.image_url,
    }
  }

  return characterById(normalized.mascotId) || CAMPUS_CHARACTERS.hero
}

/** Picker value: library id or 'custom' */
export function pickerValueFromPref(pref, library = []) {
  const n = normalizeStudentMascot(pref, library)
  return n.source === 'custom' ? 'custom' : n.mascotId
}
