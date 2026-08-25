import { supabase } from '../../src/lib/supabase.js'
import { MEDIA_TYPE, TABLES } from '../../src/constants/domain.js'

export async function listMedia({ eventId, fileType } = {}) {
  let query = supabase
    .from(TABLES.MEDIA_GALLERY)
    .select('*, events:event_id ( title, category, event_date )')
    .eq('is_hidden', false)
    .order('uploaded_on', { ascending: false })

  if (eventId) query = query.eq('event_id', eventId)
  if (fileType) query = query.eq('file_type', fileType)

  const { data, error } = await query
  return { data, error }
}

/** Staff moderation: includes hidden rows (RLS still scopes by role). */
export async function listMediaForModeration({ eventId } = {}) {
  let query = supabase
    .from(TABLES.MEDIA_GALLERY)
    .select('*, events:event_id ( title, category, event_date, organizer_id )')
    .order('uploaded_on', { ascending: false })

  if (eventId) query = query.eq('event_id', eventId)

  const { data, error } = await query
  return { data, error }
}

export async function addMedia({
  eventId,
  fileUrl,
  fileType = MEDIA_TYPE.IMAGE,
  caption = '',
  uploadedBy,
}) {
  const { data, error } = await supabase
    .from(TABLES.MEDIA_GALLERY)
    .insert([
      {
        event_id: eventId,
        file_url: fileUrl,
        file_type: fileType,
        caption,
        uploaded_by: uploadedBy || null,
      },
    ])
    .select()
    .single()
  return { data, error }
}

export async function hideMedia(id, isHidden = true) {
  const { data, error } = await supabase
    .from(TABLES.MEDIA_GALLERY)
    .update({ is_hidden: isHidden })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}
