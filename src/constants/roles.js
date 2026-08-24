/** Canonical role strings (must match Supabase profiles.role CHECK). */
export const ROLES = {
  USER: 'user',
  ORGANIZER: 'organizer',
  ADMIN: 'admin',
}

export const ASSIGNABLE_ROLES = [ROLES.USER, ROLES.ORGANIZER, ROLES.ADMIN]

export function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
}

/**
 * Post-login / post-verify home path by role.
 * Teammate: organizer UI lives under `/organizer` — connect panel there.
 */
export function homePathForRole(role) {
  const r = normalizeRole(role)
  if (r === ROLES.ADMIN) return '/admin'
  if (r === ROLES.ORGANIZER) return '/organizer'
  return '/app'
}
