/**
 * Organizer withdraw requests (demo payout queue).
 */
import { supabase } from '../lib/supabase.js'
import { RPC, TABLES } from '../constants/domain.js'

function mapWithdrawRow(row) {
  if (!row) return null
  return {
    id: row.id,
    organizerId: row.organizer_id,
    amount: Number(row.amount || 0),
    currency: row.currency || 'pkr',
    status: row.status,
    note: row.note || '',
    adminNote: row.admin_note || '',
    heldRegistrationIds: row.held_registration_ids || [],
    createdAt: row.created_at,
    processedAt: row.processed_at,
    processedBy: row.processed_by,
    organizer: row.profiles || row.organizer || null,
  }
}

export async function requestOrganizerWithdraw(note = '') {
  const { data, error } = await supabase.rpc(RPC.REQUEST_ORGANIZER_WITHDRAW, {
    p_note: note || null,
  })
  return { data: mapWithdrawRow(data), error }
}

export async function cancelOrganizerWithdraw(requestId) {
  const { data, error } = await supabase.rpc(RPC.CANCEL_ORGANIZER_WITHDRAW, {
    p_request_id: requestId,
  })
  return { data: mapWithdrawRow(data), error }
}

export async function processOrganizerWithdraw(requestId, approve, adminNote = '') {
  const { data, error } = await supabase.rpc(RPC.PROCESS_ORGANIZER_WITHDRAW, {
    p_request_id: requestId,
    p_approve: Boolean(approve),
    p_admin_note: adminNote || null,
  })
  return { data: mapWithdrawRow(data), error }
}

export async function listMyWithdrawRequests() {
  const { data, error } = await supabase
    .from(TABLES.ORGANIZER_WITHDRAW_REQUESTS)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  return { data: (data || []).map(mapWithdrawRow), error }
}

export async function listAllWithdrawRequests() {
  const { data, error } = await supabase
    .from(TABLES.ORGANIZER_WITHDRAW_REQUESTS)
    .select('*, profiles:organizer_id ( full_name, email )')
    .order('created_at', { ascending: false })
    .limit(100)
  return {
    data: (data || []).map((row) => mapWithdrawRow({ ...row, profiles: row.profiles })),
    error,
  }
}
