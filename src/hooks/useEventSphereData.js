import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { EVENT_STATUS, REGISTRATION_STATUS, TABLES } from '../constants/domain'
import { useRealtimeTables } from './useRealtimeTables'
import {
  createEvent as apiCreateEvent,
  deleteEvent as apiDeleteEvent,
  listEvents,
  postponeEvent as apiPostponeEvent,
  extendRegistrationDeadline as apiExtendRegistrationDeadline,
  cancelEventWithNotice as apiCancelEventWithNotice,
  setEventStatus as apiSetEventStatus,
  updateEvent as apiUpdateEvent,
} from '../services/events'
import {
  cancelRegistration as apiCancelRegistration,
  listMyRegistrations,
  registerForEvent as apiRegisterForEvent,
} from '../services/registrations'
import {
  listSavedEvents,
  listVenues,
  saveEvent as apiSaveEvent,
  unsaveEvent as apiUnsaveEvent,
} from '../services/venues'

const ACTIVE_REG = new Set([
  REGISTRATION_STATUS.CONFIRMED,
  REGISTRATION_STATUS.WAITLIST,
  REGISTRATION_STATUS.PENDING,
  REGISTRATION_STATUS.PENDING_PAYMENT,
])

/** Core campus tables that drive Shell lists / approvals / seats. */
const LIVE_TABLES = [
  TABLES.EVENTS,
  TABLES.REGISTRATIONS,
  TABLES.VENUES,
  TABLES.SAVED_EVENTS,
  TABLES.EVENT_PAYMENTS,
]

function activeRegistrationIds(rows) {
  return (rows || [])
    .filter((r) => r && ACTIVE_REG.has(r.status))
    .map((r) => r.eventId)
}

export function useEventSphereData() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [saved, setSaved] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [registrationRows, setRegistrationRows] = useState([])
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      setError('Supabase is not configured')
      return { ok: false }
    }

    setError(null)
    const [eventsRes, venuesRes] = await Promise.all([
      listEvents(),
      listVenues(),
    ])

    if (eventsRes.error) {
      setError(eventsRes.error.message)
      setEvents([])
    } else {
      setEvents(eventsRes.data || [])
    }

    if (!venuesRes.error) {
      setVenues(venuesRes.data || [])
    }

    if (user?.id) {
      const [regsRes, savedRes] = await Promise.all([
        listMyRegistrations(user.id),
        listSavedEvents(user.id),
      ])
      if (!regsRes.error) {
        setRegistrationRows(regsRes.data || [])
        setRegistrations(activeRegistrationIds(regsRes.data))
      }
      if (!savedRes.error) {
        setSaved((savedRes.data || []).map((row) => row.event_id))
      }
    } else {
      setRegistrations([])
      setRegistrationRows([])
      setSaved([])
    }

    setLoading(false)
    return { ok: !eventsRes.error }
  }, [user?.id])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  // Admin approvals, seats, venues, payments — live across tabs (no manual reload)
  useRealtimeTables(LIVE_TABLES, refresh, {
    channelName: 'es-campus-core',
    debounceMs: 400,
    refreshOnFocus: true,
  })

  const createEventAction = useCallback(
    async (form, uiStatus) => {
      if (!user?.id) return { error: { message: 'Sign in required' } }
      const { data, error: err } = await apiCreateEvent(
        {
          ...form,
          status: uiStatus,
          symbol: String(form.title || 'EV')
            .slice(0, 2)
            .toUpperCase(),
        },
        user.id,
      )
      if (!err && data) {
        await refresh()
      }
      return { data, error: err }
    },
    [user?.id, refresh],
  )

  const setStatusAction = useCallback(
    async (id, uiStatus) => {
      const { data, error: err } = await apiSetEventStatus(id, uiStatus)
      if (!err) await refresh()
      return { data, error: err }
    },
    [refresh],
  )

  const deleteEventAction = useCallback(
    async (id) => {
      const { error: err } = await apiDeleteEvent(id)
      if (!err) await refresh()
      return { error: err }
    },
    [refresh],
  )

  const updateEventAction = useCallback(
    async (id, updates) => {
      const { data, error: err } = await apiUpdateEvent(id, updates)
      if (!err) await refresh()
      return { data, error: err }
    },
    [refresh],
  )

  const postponeEventAction = useCallback(
    async (id, payload) => {
      const { data, error: err, announcement } = await apiPostponeEvent(id, payload)
      if (!err || data) await refresh()
      return { data, error: err, announcement }
    },
    [refresh],
  )

  const extendRegistrationAction = useCallback(
    async (id, payload) => {
      const { data, error: err, notified, extended, announcement } =
        await apiExtendRegistrationDeadline(id, payload)
      if (!err || data) await refresh()
      return { data, error: err, notified, extended, announcement }
    },
    [refresh],
  )

  const cancelEventAction = useCallback(
    async (id, payload) => {
      const { data, error: err, announcement } = await apiCancelEventWithNotice(id, payload)
      if (!err || data) await refresh()
      return { data, error: err, announcement }
    },
    [refresh],
  )

  const duplicateEventAction = useCallback(
    async (event) => {
      if (!user?.id) return { error: { message: 'Sign in required' } }
      return createEventAction(
        {
          title: `${event.title} Copy`,
          description: event.description,
          category: event.category,
          date: event.date,
          time: event.time,
          venue: event.venue,
          capacity: event.capacity,
          art: event.art,
        },
        EVENT_STATUS.DRAFT,
      )
    },
    [user?.id, createEventAction],
  )

  const registerAction = useCallback(
    async (eventId) => {
      if (!eventId) return { error: { message: 'Missing event id' } }
      const { data, error: err } = await apiRegisterForEvent(eventId)
      if (!err) {
        // Optimistic UI so pass/list update even if a later refresh is slow
        setRegistrations((prev) =>
          prev.includes(eventId) ? prev : [...prev, eventId],
        )
        if (data) {
          setRegistrationRows((prev) => {
            const others = (prev || []).filter((r) => r.eventId !== eventId)
            return [data, ...others]
          })
        }
        await refresh()
      }
      return { data, error: err }
    },
    [refresh],
  )

  const cancelRegisterAction = useCallback(
    async (eventId) => {
      const { data, error: err } = await apiCancelRegistration(eventId)
      if (!err) await refresh()
      return { data, error: err }
    },
    [refresh],
  )

  const toggleSaveAction = useCallback(
    async (eventId) => {
      if (!user?.id) return { error: { message: 'Sign in required' } }
      const isSaved = saved.includes(eventId)
      const { error: err } = isSaved
        ? await apiUnsaveEvent(user.id, eventId)
        : await apiSaveEvent(user.id, eventId)
      if (!err) await refresh()
      return { saved: !isSaved, error: err }
    },
    [user?.id, saved, refresh],
  )

  return {
    events,
    setEvents,
    saved,
    setSaved,
    registrations,
    registrationRows,
    setRegistrations,
    venues,
    loading,
    error,
    refresh,
    actions: {
      createEvent: createEventAction,
      setStatus: setStatusAction,
      deleteEvent: deleteEventAction,
      updateEvent: updateEventAction,
      postponeEvent: postponeEventAction,
      extendRegistrationDeadline: extendRegistrationAction,
      cancelEvent: cancelEventAction,
      duplicateEvent: duplicateEventAction,
      register: registerAction,
      cancelRegister: cancelRegisterAction,
      toggleSave: toggleSaveAction,
    },
  }
}
