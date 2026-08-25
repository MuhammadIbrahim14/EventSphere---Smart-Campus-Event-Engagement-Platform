/**
 * Supabase Storage uploads for event banners / gallery (Phase C).
 * Bucket: event-media (create via supabase/eventsphere-phase-c.sql notes).
 */
import { supabase } from '../../src/lib/supabase.js'

const BUCKET = 'event-media'

export async function uploadEventMedia(file, { folder = 'gallery', fileName } = {}) {
  if (!file) return { data: null, error: { message: 'No file provided' } }

  const safeName = (fileName || file.name || 'upload.bin')
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 120)
  const path = `${folder}/${Date.now()}-${safeName}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (upErr) return { data: null, error: upErr }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return {
    data: { path, publicUrl: data?.publicUrl || null, bucket: BUCKET },
    error: null,
  }
}
