import { supabase } from '../../src/lib/supabase.js'
import { TABLES } from '../../src/constants/domain.js'

const TABLE = TABLES.EVENT_CATEGORIES

function friendlyError(error) {
  if (!error) return null
  const msg = String(error.message || '')
  const code = String(error.code || '')
  if (code === 'PGRST116' || /0 rows|no rows|multiple \(or no\) rows/i.test(msg)) {
    return {
      ...error,
      message:
        'Category update blocked. Run supabase/fix-category-update.sql in Supabase SQL Editor, then retry.',
    }
  }
  if (/duplicate|unique|already exists/i.test(msg)) {
    return { ...error, message: 'A category with this name already exists' }
  }
  return error
}

export async function listCategories() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('name', { ascending: true })
  return { data: data || [], error }
}

export async function createCategory(name, createdBy) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return { data: null, error: { message: 'Category name is required' } }

  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ name: trimmed, created_by: createdBy || null }])
    .select('*')
    .single()
  return { data, error: friendlyError(error) }
}

export async function updateCategory(id, name) {
  const trimmed = String(name || '').trim()
  if (!id) return { data: null, error: { message: 'Category id is required' } }
  if (!trimmed) return { data: null, error: { message: 'Category name is required' } }

  // Prefer RPC (role-checked, works even if UPDATE RLS was missing)
  const rpc = await supabase.rpc('update_event_category', {
    p_id: id,
    p_name: trimmed,
  })

  if (!rpc.error) {
    return { data: rpc.data, error: null }
  }

  // Fallback: direct update (when RPC not deployed yet)
  const rpcMissing = /could not find the function|schema cache|does not exist/i.test(
    String(rpc.error?.message || ''),
  )
  if (!rpcMissing) {
    return { data: null, error: friendlyError(rpc.error) }
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ name: trimmed })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) return { data: null, error: friendlyError(error) }
  if (!data) {
    return {
      data: null,
      error: {
        message:
          'Category update blocked. Run supabase/fix-category-update.sql in Supabase SQL Editor, then retry.',
      },
    }
  }
  return { data, error: null }
}

export async function deleteCategory(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  return { error: friendlyError(error) }
}
