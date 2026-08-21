import { supabase } from '../lib/supabase'

/** GET — all profiles (admin RLS) */
export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

/** PUT — update role (admin only via RLS) */
export async function updateProfileRole(id, role) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}
