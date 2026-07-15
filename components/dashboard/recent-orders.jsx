import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatMoney } from '@/api/inventory/inventory-client'
import { formatOrderTime } from '@/helper/storeAnalytics'

export function RecentOrders({ orders, stores }) {
  if (orders.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded p-5 mb-6">
        <div className="flex items-center justify-between mb-4" style={{ padding: '0' }}>
          <h3 className="text-[15px] font-semibold text-foreground">Đơn hàng gần đây</h3>
          <Link className="text-sm text-accent hover:underline" href="/orders">Xem tất cả</Link>
        </div>
        <div style={{ paddingTop: 0 }}>
          <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
            <p className="text-sm text-muted">Chưa có đơn hàng nào.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-5 mb-6">
      <div className="flex items-center justify-between mb-4" style={{ padding: '0' }}>
        <h3 className="text-[15px] font-semibold text-foreground">Đơn hàng gần đây</h3>
        <Link className="text-sm text-accent hover:underline" href="/orders">Xem tất cả</Link>
      </div>
      <div style={{ paddingTop: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Cửa hàng</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Giá trị</th>
                <th style={{ textAlign: 'right' }}>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map((order) => (
                <tr key={order.id}>
                  <td>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {order.code || `#${String(order.id).slice(0, 8)}`}
                    </span>
                  </td>
                  <td className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                    {(() => {
                      const s = stores.find(st => String(st.id) === String(order.customer_store_id))
                      return s?.name || order.customer_store_name || order.store_name || '—'
                    })()}
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="font-semibold text-right">
                    {formatMoney(order.total_amount)}
                  </td>
                  <td className="text-xs text-muted whitespace-nowrap text-right">
                    {formatOrderTime(order.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
