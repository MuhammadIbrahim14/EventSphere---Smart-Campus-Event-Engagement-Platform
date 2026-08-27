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

const MASCOT_TYPES = new Set(['image/png', 'image/webp', 'image/jpeg', 'image/jpg'])
const MAX_MASCOT_BYTES = 2 * 1024 * 1024

/** Student-owned dashboard mascot upload — scoped folder per user id. */
export async function uploadStudentMascot(file, userId, { maxMb = 2 } = {}) {
  if (!file) return { data: null, error: { message: 'No file provided' } }
  if (!userId) return { data: null, error: { message: 'User id required' } }

  const type = String(file.type || '').toLowerCase()
  if (!MASCOT_TYPES.has(type)) {
    return { data: null, error: { message: 'Use PNG, WebP, or JPG only' } }
  }

  const limit = Math.min(5, Math.max(1, Number(maxMb) || 2)) * 1024 * 1024
  if (file.size > limit) {
    return { data: null, error: { message: `Image must be under ${Math.round(limit / 1024 / 1024)}MB` } }
  }

  return uploadEventMedia(file, {
    folder: `student-mascots/${userId}`,
    fileName: file.name || 'mascot.png',
  })
}

/** Admin campus mascot asset upload. */
export async function uploadCampusMascotAsset(file) {
  return uploadEventMedia(file, {
    folder: 'campus-mascots',
    fileName: file.name || 'mascot.png',
  })
}

const AVATAR_TYPES = new Set(['image/png', 'image/webp', 'image/jpeg', 'image/jpg'])
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

/** Profile photo — scoped folder per user id under event-media/avatars. */
export async function uploadAvatar(file, userId) {
  if (!file) return { data: null, error: { message: 'No file provided' } }
  if (!userId) return { data: null, error: { message: 'User id required' } }

  const type = String(file.type || '').toLowerCase()
  if (!AVATAR_TYPES.has(type)) {
    return { data: null, error: { message: 'Use PNG, WebP, or JPG only' } }
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { data: null, error: { message: 'Image must be under 2MB' } }
  }

  return uploadEventMedia(file, {
    folder: `avatars/${userId}`,
    fileName: file.name || 'avatar.png',
  })
}
