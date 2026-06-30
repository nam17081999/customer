import { db } from '@/api/db/client'

const STORE_SELECT_FIELDS = 'id,name,store_type,latitude,longitude,address_detail,ward,district,phone,phone_secondary,note,active,created_at,updated_at,is_potential,last_called_at,last_call_result,last_call_result_at,last_order_reported_at,sales_note'

export async function fetchPageForExport({ fields, from, to }) {
  const { data, error } = await db
    .from('stores')
    .select(fields)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  return data || []
}

export async function verifyStores(ids) {
  const { error } = await db
    .from('stores')
    .update({ active: true, updated_at: new Date().toISOString() })
    .in('id', ids)
  return { error }
}

export async function bulkInsertStores(rows) {
  const { data, error } = await db.from('stores').insert(rows).select()
  if (error) throw error
  return data || []
}

export async function updateStoreAndResolveDuplicate(id, patch) {
  const { data, error } = await db
    .from('stores')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function mergePrimaryStore(id, updates) {
  const { error } = await db
    .from('stores')
    .update(updates)
    .eq('id', id)
  return { error }
}

export async function softDeleteSecondaryStores(ids) {
  const timestamp = new Date().toISOString()
  const { error } = await db
    .from('stores')
    .update({ deleted_at: timestamp, updated_at: timestamp })
    .in('id', ids)
  return { error }
}

export async function softDeleteStore(id) {
  const nowIso = new Date().toISOString()
  const { error } = await db
    .from('stores')
    .update({ deleted_at: nowIso, updated_at: nowIso })
    .eq('id', id)
  return { error }
}

export async function createStore(payload) {
  const { data, error } = await db.from('stores').insert([payload]).select(STORE_SELECT_FIELDS)
  return { data, error }
}

export async function updateStore(id, updates) {
  const { error } = await db.from('stores').update(updates).eq('id', id)
  return { error }
}

export async function saveCallResult(storeId, updates) {
  const { error } = await db.from('stores').update(updates).eq('id', storeId)
  return { error }
}

export async function fetchEditHistory(storeId, offset, pageSize) {
  const { data, error } = await db
    .from('store_edit_history')
    .select('id, store_id, action_type, actor_user_id, actor_role, changes, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)
  return { data: data || [], error }
}
