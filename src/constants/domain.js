/**
 * Domain constants — single source of truth for DB enums / table names.
 * Use these everywhere instead of string literals (Phase B+).
 * Does not change App.tsx or auth behaviour by itself.
 */

export const TABLES = Object.freeze({
  PROFILES: 'profiles',
  VENUES: 'venues',
  EVENTS: 'events',
  REGISTRATIONS: 'registrations',
  ATTENDANCE: 'attendance',
  FEEDBACK: 'feedback',
  CERTIFICATES: 'certificates',
  MEDIA_GALLERY: 'media_gallery',
  SAVED_EVENTS: 'saved_events',
  ANNOUNCEMENTS: 'announcements',
  CALENDAR_SYNC: 'calendar_sync',
  EVENT_SHARE_LOG: 'event_share_log',
  EVENT_CATEGORIES: 'event_categories',
  EVENT_PAYMENTS: 'event_payments',
  PAYMENT_AUDIT_LOG: 'payment_audit_log',
  STUDENT_NOTICES: 'student_notices',
  EVENT_QUESTIONS: 'event_questions',
  PROMO_CODES: 'promo_codes',
  PROMO_REDEMPTIONS: 'promo_redemptions',
  SPONSORS: 'sponsors',
  REFERRALS: 'referrals',
  VENUE_MAPS: 'venue_maps',
  VENUE_MAP_PINS: 'venue_map_pins',
  CONTESTS: 'contests',
  CONTEST_ENTRIES: 'contest_entries',
  ACHIEVEMENT_BADGES: 'achievement_badges',
  USER_BADGES: 'user_badges',
  VIP_INVITES: 'vip_invites',
})

/** Student interest tags (signup + recommendations). */
export const STUDENT_INTERESTS = Object.freeze([
  'Coding',
  'Sports',
  'Music',
  'Art',
  'Gaming',
  'Technology',
  'Business',
  'Cultural',
  'Photography',
  'Design',
])

/** Map interests → event category keywords for recommendations. */
export const INTEREST_CATEGORY_MAP = Object.freeze({
  Coding: ['Technology', 'Education'],
  Sports: ['Sports'],
  Music: ['Cultural', 'Entertainment'],
  Art: ['Arts', 'Cultural'],
  Gaming: ['Entertainment', 'Technology', 'Social'],
  Technology: ['Technology', 'Education'],
  Business: ['Business', 'Education'],
  Cultural: ['Cultural', 'Social', 'Arts'],
  Photography: ['Arts', 'Entertainment'],
  Design: ['Arts', 'Technology'],
})

export const EVENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
})

export const EVENT_STATUS_LIST = Object.freeze(Object.values(EVENT_STATUS))

/** UI labels used by EventSphere screens (map DB → display). */
export const EVENT_STATUS_LABEL = Object.freeze({
  [EVENT_STATUS.DRAFT]: 'Draft',
  [EVENT_STATUS.PENDING]: 'Pending',
  [EVENT_STATUS.APPROVED]: 'Approved',
  [EVENT_STATUS.REJECTED]: 'Rejected',
  [EVENT_STATUS.CANCELLED]: 'Cancelled',
})

export const REGISTRATION_STATUS = Object.freeze({
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  WAITLIST: 'waitlist',
  PENDING: 'pending',
  PENDING_PAYMENT: 'pending_payment',
})

export const REGISTRATION_STATUS_LIST = Object.freeze(
  Object.values(REGISTRATION_STATUS),
)

export const PAYMENT_STATUS = Object.freeze({
  NOT_REQUIRED: 'not_required',
  PENDING: 'pending',
  PAID: 'paid',
  PARTIALLY_REFUNDED: 'partially_refunded',
  REFUNDED: 'refunded',
  FORFEITED: 'forfeited',
  FAILED: 'failed',
  EXPIRED: 'expired',
})

export const PAYMENT_STATUS_LABEL = Object.freeze({
  [PAYMENT_STATUS.NOT_REQUIRED]: 'Free',
  [PAYMENT_STATUS.PENDING]: 'Payment pending',
  [PAYMENT_STATUS.PAID]: 'Paid',
  [PAYMENT_STATUS.PARTIALLY_REFUNDED]: 'Deposit refunded',
  [PAYMENT_STATUS.REFUNDED]: 'Refunded',
  [PAYMENT_STATUS.FORFEITED]: 'Deposit forfeited',
  [PAYMENT_STATUS.FAILED]: 'Payment failed',
  [PAYMENT_STATUS.EXPIRED]: 'Checkout expired',
})

export const ATTENDANCE_METHOD = Object.freeze({
  QR: 'qr',
  MANUAL: 'manual',
})

export const MEDIA_TYPE = Object.freeze({
  IMAGE: 'image',
  VIDEO: 'video',
})

export const ANNOUNCEMENT_AUDIENCE = Object.freeze({
  EVERYONE: 'everyone',
  STUDENTS: 'students',
  ORGANIZERS: 'organizers',
  ADMINS: 'admins',
})

export const VENUE_AVAILABILITY = Object.freeze({
  AVAILABLE: 'available',
  LIMITED: 'limited',
  BOOKED: 'booked',
})

/** Default event categories (SRS). UI may extend via DB values. */
export const EVENT_CATEGORIES = Object.freeze([
  'Technology',
  'Sports',
  'Cultural',
  'Business',
  'Arts',
  'Education',
  'Entertainment',
  'Social',
])

export const RPC = Object.freeze({
  REGISTER_FOR_EVENT: 'register_for_event',
  CANCEL_REGISTRATION: 'cancel_registration',
  SEATS_AVAILABLE: 'seats_available',
  CONFIRMED_REGISTRATION_COUNT: 'confirmed_registration_count',
  IS_EVENT_ORGANIZER: 'is_event_organizer',
  START_PAID_REGISTRATION: 'start_paid_registration',
  MARK_REGISTRATION_CHECKOUT_SESSION: 'mark_registration_checkout_session',
  MARK_REGISTRATION_FORFEITED: 'mark_registration_forfeited',
})
