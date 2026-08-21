import { supabase } from '../lib/supabase'

/** GET — list items (own items for users; all for admin via RLS) */
export async function getItems() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

/** GET — single item */
export async function getItem(id) {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return { data, error }
}

/** POST — create item */
export async function createItem({ userId, title, description = '', status = 'active' }) {
  const { data, error } = await supabase
    .from('items')
    .insert([{ user_id: userId, title, description, status }])
    .select()
    .single()
  return { data, error }
}

/** PUT — update item */
export async function updateItem(id, updates) {
  const { data, error } = await supabase
    .from('items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

/** DELETE — remove item */
export async function deleteItem(id) {
  const { error } = await supabase.from('items').delete().eq('id', id)
  return { error }
}
