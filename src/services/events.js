/** Events — see server/routes/events.js (Phase A; wire in Phase B). */
export {
  listEvents,
  listApprovedEvents,
  getEvent,
  createEvent,
  updateEvent,
  setEventStatus,
  postponeEvent,
  cancelEventWithNotice,
  deleteEvent,
} from '../../server/routes/events.js'
