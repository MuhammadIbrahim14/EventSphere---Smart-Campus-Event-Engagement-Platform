/**
 * Items CRUD routes (demo GET/POST/PUT/DELETE).
 * Frontend: import from src/services/items.js (thin re-export).
 */
import { supabase } from '../../src/lib/supabase.js'

/** GET /items */
export async function getItems() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

/** GET /items/:id */
export async function getItem(id) {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return { data, error }
}

/** POST /items */
export async function createItem({ userId, title, description = '', status = 'active' }) {
  const { data, error } = await supabase
    .from('items')
    .insert([{ user_id: userId, title, description, status }])
    .select()
    .single()
  return { data, error }
}

/** PUT /items/:id */
export async function updateItem(id, updates) {
  const { data, error } = await supabase
    .from('items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

/** DELETE /items/:id */
export async function deleteItem(id) {
  const { error } = await supabase.from('items').delete().eq('id', id)
  return { error }
}
