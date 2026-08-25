import { supabase } from '../../src/lib/supabase.js'
import { TABLES } from '../../src/constants/domain.js'

export async function logEventShare({
  userId = null,
  eventId,
  platform,
  shareMessage = '',
}) {
  if (!eventId || !platform) return { data: null, error: null }
  const { data, error } = await supabase
    .from(TABLES.EVENT_SHARE_LOG)
    .insert([
      {
        user_id: userId,
        event_id: eventId,
        platform,
        share_message: shareMessage,
      },
    ])
    .select()
    .maybeSingle()
  return { data, error }
}
