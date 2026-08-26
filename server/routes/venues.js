import { supabase } from '../../src/lib/supabase.js'
import { TABLES } from '../../src/constants/domain.js'

export async function listVenues() {
  const { data, error } = await supabase
    .from(TABLES.VENUES)
    .select('*')
    .order('name', { ascending: true })
  return { data, error }
}

function geoFields(payload = {}) {
  const out = {}
  if (payload.location != null) out.location = payload.location
  // Only send coords when set — safe if geo columns not migrated yet (text location still works).
  if (payload.latitude != null && payload.latitude !== '') {
    const n = Number(payload.latitude)
    if (Number.isFinite(n)) out.latitude = n
  }
  if (payload.longitude != null && payload.longitude !== '') {
    const n = Number(payload.longitude)
    if (Number.isFinite(n)) out.longitude = n
  }
  if (payload.map_place_id) out.map_place_id = payload.map_place_id
  return out
}

export async function createVenue(payload) {
  const { data, error } = await supabase
    .from(TABLES.VENUES)
    .insert([
      {
        name: payload.name,
        location: payload.location || '',
        capacity: Number(payload.capacity) || 0,
        availability: payload.availability || 'available',
        ...geoFields(payload),
      },
    ])
    .select()
    .single()
  return { data, error }
}

export async function updateVenue(id, updates) {
  const { data, error } = await supabase
    .from(TABLES.VENUES)
    .update({
      ...(updates.name != null ? { name: updates.name } : {}),
      ...(updates.capacity != null ? { capacity: Number(updates.capacity) || 0 } : {}),
      ...(updates.availability != null ? { availability: updates.availability } : {}),
      ...geoFields(updates),
    })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteVenue(id) {
  const { error } = await supabase.from(TABLES.VENUES).delete().eq('id', id)
  return { error }
}

export async function listSavedEvents(userId) {
  const { data, error } = await supabase
    .from(TABLES.SAVED_EVENTS)
    .select('*, events:event_id ( * )')
    .eq('user_id', userId)
    .order('saved_on', { ascending: false })
  return { data, error }
}

export async function saveEvent(userId, eventId) {
  const { data, error } = await supabase
    .from(TABLES.SAVED_EVENTS)
    .upsert({ user_id: userId, event_id: eventId }, { onConflict: 'user_id,event_id' })
    .select()
    .single()
  return { data, error }
}

export async function unsaveEvent(userId, eventId) {
  const { error } = await supabase
    .from(TABLES.SAVED_EVENTS)
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId)
  return { error }
}
