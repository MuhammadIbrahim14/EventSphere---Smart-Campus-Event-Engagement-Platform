import { supabase } from '../../src/lib/supabase.js'
import { TABLES } from '../../src/constants/domain.js'

export async function logCalendarSync({
  userId,
  eventId,
  calendarUrl = null,
  calendarType = 'ics',
}) {
  if (!userId || !eventId) return { data: null, error: null }
  const { data, error } = await supabase
    .from(TABLES.CALENDAR_SYNC)
    .insert([
      {
        user_id: userId,
        event_id: eventId,
        calendar_type: calendarType || 'ics',
        calendar_url: calendarUrl,
      },
    ])
    .select()
    .maybeSingle()
  return { data, error }
}

