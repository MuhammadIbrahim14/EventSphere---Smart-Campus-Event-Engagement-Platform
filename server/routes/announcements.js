import { supabase } from '../../src/lib/supabase.js'
import { ANNOUNCEMENT_AUDIENCE, TABLES } from '../../src/constants/domain.js'

export async function listAnnouncements({ audience } = {}) {
  let query = supabase
    .from(TABLES.ANNOUNCEMENTS)
    .select('*, profiles:created_by ( full_name, email, role )')
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  if (audience) {
    query = query.in('audience', [ANNOUNCEMENT_AUDIENCE.EVERYONE, audience])
  }

  const { data, error } = await query
  return { data, error }
}

export async function createAnnouncement(payload) {
  const { data, error } = await supabase
    .from(TABLES.ANNOUNCEMENTS)
    .insert([
      {
        title: payload.title,
        body: payload.body || '',
        audience: payload.audience || ANNOUNCEMENT_AUDIENCE.EVERYONE,
        event_id: payload.eventId || null,
        created_by: payload.createdBy || null,
        is_published: payload.isPublished !== false,
      },
    ])
    .select('*, profiles:created_by ( full_name, email, role )')
    .single()
  return { data, error }
}
