import useSWR from 'swr'
import { getOrRefreshStores } from '@/lib/storeCache'
import {
  listProductsWithStock,
  listSalesOrders,
  listPurchaseOrders,
  getInventoryReconciliationReport,
  getDashboardAggregateReport,
} from '@/api/inventory/inventory-client'
import { loadDashboardData } from '@/services/dashboard/dashboard-page-service'

const DASHBOARD_CACHE_KEY = 'npp-dashboard-data'

export function useDashboardData() {
  const { data, error, isLoading, mutate } = useSWR(
    DASHBOARD_CACHE_KEY,
    () => loadDashboardData({
      getStores: getOrRefreshStores,
      listProducts: () => listProductsWithStock(),
      listOrders: () => listSalesOrders(20),
      listPurchases: () => listPurchaseOrders({ page: 1, pageSize: 20 }),
      getReconciliation: getInventoryReconciliationReport,
      getAggregate: getDashboardAggregateReport,
    }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    }
  )

  return {
    stores: data?.stores || [],
    products: data?.products || [],
    orders: data?.orders || [],
    purchases: data?.purchases || [],
    reconciliationRows: data?.reconciliationRows || [],
    aggregateReport: data?.aggregateReport || null,
    summary: data?.summary || null,
    health: data?.health || null,
    loading: isLoading || (!data && !error),
    error: error ? 'Không tải được dữ liệu tổng quan. Vui lòng thử lại.' : (data?.error || null),
    refresh: mutate,
  }
}
