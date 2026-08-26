/** Events — see server/routes/events.js (Phase A; wire in Phase B). */
export {
  listEvents,
  listApprovedEvents,
  getEvent,
  createEvent,
  updateEvent,
  setEventStatus,
  postponeEvent,
  extendRegistrationDeadline,
  cancelEventWithNotice,
  deleteEvent,
  getEventCheckinMeta,
  ensureEventCheckinToken,
} from '../../server/routes/events.js'
