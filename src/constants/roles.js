/** Canonical role strings (must match Supabase profiles.role CHECK). */
export const ROLES = {
  USER: 'user',
  ORGANIZER: 'organizer',
  ADMIN: 'admin',
}

/** UI orbit used by EventSphere App.tsx (`user` → student panel). */
export const UI_ROLES = {
  STUDENT: 'student',
  ORGANIZER: 'organizer',
  ADMIN: 'admin',
}

export const ASSIGNABLE_ROLES = [ROLES.USER, ROLES.ORGANIZER, ROLES.ADMIN]

export function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
}

/** Map DB profile.role → EventSphere UI role (`student` | `organizer` | `admin`). */
export function uiRoleFromProfile(role) {
  const r = normalizeRole(role)
  if (r === ROLES.ADMIN) return UI_ROLES.ADMIN
  if (r === ROLES.ORGANIZER) return UI_ROLES.ORGANIZER
  if (r === ROLES.USER || r === UI_ROLES.STUDENT) return UI_ROLES.STUDENT
  return null
}

/** Post-login / post-verify home path by role. */
export function homePathForRole(role) {
  const ui = uiRoleFromProfile(role) || UI_ROLES.STUDENT
  return `/${ui}/dashboard`
}
