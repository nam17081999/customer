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
    createdAt: item.created_at, // ISO string từ DB — timestamp gốc
  }))
}
