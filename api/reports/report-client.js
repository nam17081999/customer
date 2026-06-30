import { db } from '@/api/db/client'

export async function getPendingReportCount() {
  const { count, error } = await db
    .from('store_reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) throw error
  return typeof count === 'number' ? count : 0
}

export async function getPendingReportItems() {
  const { data, error } = await db
    .from('store_reports')
    .select('id, store_id, report_type, status, created_at, store:stores!inner(name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw error
  return (data || []).map((item) => ({
    id: item.id,
    storeName: item.store?.name || '—',
    title: item.report_type === 'edit'
      ? 'Yêu cầu sửa thông tin'
      : 'Báo cáo sai lệch',
    status: item.status,
    createdAt: item.created_at,
  }))
}

export async function fetchPendingReports() {
  const { data, error } = await db
    .from('store_reports')
    .select('*, store:stores!inner(name, store_type, address_detail, ward, district, phone, phone_secondary, latitude, longitude, active, deleted_at)')
    .eq('status', 'pending')
    .is('stores.deleted_at', null)
    .order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function updateReportStatus(reportId, status) {
  const { error } = await db
    .from('store_reports')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', reportId)
  return { error }
}

export async function applyReportEdit(storeId, storeUpdates, reportId) {
  const { error: storeError } = await db
    .from('stores')
    .update(storeUpdates)
    .eq('id', storeId)
  if (storeError) return { error: storeError }

  const { error: reportError } = await db
    .from('store_reports')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', reportId)
  return { error: reportError }
}

export async function submitReport(payload) {
  const { error } = await db.from('store_reports').insert([payload])
  return { error }
}
