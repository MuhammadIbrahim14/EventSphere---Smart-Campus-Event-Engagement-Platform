/**
 * Profiles API routes (Supabase PostgREST via client).
 * Frontend: import from src/services/profiles.js (thin re-export).
 */
import { supabase } from '../../src/lib/supabase.js'

/** GET /profiles */
export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

/** PUT /profiles/:id/role */
export async function updateProfileRole(id, role) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}
