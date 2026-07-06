import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatMoney } from '@/api/inventory/inventory-client'
import { formatOrderTime } from '@/helper/storeAnalytics'

export function RecentOrders({ orders, stores }) {
  if (orders.length === 0) {
    return (
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ padding: '16px 20px 0' }}>
          <h3>Đơn hàng gần đây</h3>
          <Link href="/orders">Xem tất cả</Link>
        </div>
        <div className="card-body" style={{ paddingTop: 8 }}>
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <p>Chưa có đơn hàng nào.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header" style={{ padding: '16px 20px 0' }}>
        <h3>Đơn hàng gần đây</h3>
        <Link href="/orders">Xem tất cả</Link>
      </div>
      <div className="card-body" style={{ paddingTop: 8 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="orders-table">
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
                  <td className="order-store">
                    {(() => {
                      const s = stores.find(st => String(st.id) === String(order.customer_store_id))
                      return s?.name || order.customer_store_name || order.store_name || '—'
                    })()}
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="order-amount" style={{ textAlign: 'right' }}>
                    {formatMoney(order.total_amount)}
                  </td>
                  <td className="order-time" style={{ textAlign: 'right' }}>
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
