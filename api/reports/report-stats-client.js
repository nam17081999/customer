import { supabase } from '@/lib/supabaseClient'

export async function getPendingReportCount() {
  const { count, error } = await supabase
    .from('store_reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) throw error
  return typeof count === 'number' ? count : 0
}
