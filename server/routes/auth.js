/**
 * Auth-related helpers used by the SPA (not a separate Express process).
 * Session / role reads stay in AuthContext; OTP stays in emailOtp service.
 */
export { homePathForRole, ROLES, normalizeRole } from '../../src/constants/roles.js'
