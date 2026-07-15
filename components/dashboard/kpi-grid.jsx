import { formatMoney } from '@/api/inventory/inventory-client'

export function KpiGrid({ loading, error, summary, health }) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-900 border border-gray-700 rounded p-[16px_18px] relative overflow-hidden">
            <div className="h-3 rounded bg-gray-800 w-[60%] mb-2" />
            <div className="h-8 rounded bg-gray-800 w-[40%]" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: 'oklch(60% 0.16 28 / 0.1)', border: '1px solid oklch(60% 0.16 28 / 0.2)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--red)' }}>{error}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        <div className="bg-gray-900 border border-gray-700 rounded p-[16px_18px] relative overflow-hidden transition-transform hover:-translate-y-px">
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t" style={{ background: 'linear-gradient(90deg, var(--accent), oklch(60% 0.18 260))' }} />
          <div className="text-xs text-muted uppercase tracking-[0.4px] font-semibold mb-1">Tổng cửa hàng</div>
          <div className="text-[22px] font-bold tracking-[-0.3px]" style={{ color: 'var(--accent)' }}>{summary.totalStores}</div>
          <div className="text-xs font-semibold mt-0.5 text-muted">Toàn bộ hệ thống</div>
          {summary.last7DaysStores > 0 && (
            <div className="text-xs font-semibold mt-0.5 text-green-500">↑ {summary.last7DaysStores} (7 ngày)</div>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded p-[16px_18px] relative overflow-hidden transition-transform hover:-translate-y-px">
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t" style={{ background: 'linear-gradient(90deg, var(--green), oklch(60% 0.14 150))' }} />
          <div className="text-xs text-muted uppercase tracking-[0.4px] font-semibold mb-1">Đã xác thực</div>
          <div className="text-[22px] font-bold tracking-[-0.3px]" style={{ color: 'var(--green)' }}>{summary.verifiedStores}</div>
          <div className="text-xs font-semibold mt-0.5 text-muted">{summary.totalStores > 0 ? `${summary.verificationRate}% tổng số` : 'Chưa có dữ liệu'}</div>
          {summary.verifiedStores > 0 && <div className="text-xs font-semibold mt-0.5 text-green-500">↑ {summary.verifiedStores} cửa hàng</div>}
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded p-[16px_18px] relative overflow-hidden transition-transform hover:-translate-y-px">
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t" style={{ background: 'linear-gradient(90deg, var(--amber), oklch(65% 0.16 90))' }} />
          <div className="text-xs text-muted uppercase tracking-[0.4px] font-semibold mb-1">Chưa xác thực</div>
          <div className="text-[22px] font-bold tracking-[-0.3px]" style={{ color: 'var(--amber)' }}>{summary.unverifiedStores}</div>
          <div className="text-xs font-semibold mt-0.5 text-muted">{summary.totalStores > 0 ? `${(100 - summary.verificationRate)}% tổng số` : 'Chưa có dữ liệu'}</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded p-[16px_18px] relative overflow-hidden transition-transform hover:-translate-y-px">
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t" style={{ background: 'linear-gradient(90deg, var(--purple), oklch(58% 0.14 295))' }} />
          <div className="text-xs text-muted uppercase tracking-[0.4px] font-semibold mb-1">Tỷ lệ xác thực</div>
          <div className="text-[22px] font-bold tracking-[-0.3px]" style={{ color: 'var(--purple)' }}>{summary.verificationRate}%</div>
          <div className="text-xs font-semibold mt-0.5 text-muted">{summary.totalStores > 0 ? `${summary.verifiedStores}/${summary.totalStores} cửa hàng` : 'Chưa có dữ liệu'}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3.5 mb-6">
        <div className="bg-gray-900 border border-gray-700 rounded p-[16px_18px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted">Doanh thu hôm nay</span>
            <span className="text-lg font-bold" style={{ color: 'var(--green)' }}>{formatMoney(health.revenue)}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((health.revenue || 0) / 50000000 * 100))}%`, background: 'var(--green)' }} />
          </div>
          <div className="mt-1.5 text-[11px] text-muted">
            {health.activeOrderCount} đơn hiệu lực
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded p-[16px_18px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted">Đơn đang xử lý</span>
            <span className="text-lg font-bold text-foreground">{health.activeOrderCount}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((health.activeOrderCount || 0) / 50 * 100))}%`, background: 'var(--accent)' }} />
          </div>
          <div className="mt-1.5 text-[11px] text-muted">
            {health.reconciliationIssueCount > 0 ? `${health.reconciliationIssueCount} đơn cần đối soát` : 'Đơn hàng ổn định'}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded p-[16px_18px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted">Tồn kho thấp</span>
            <span className="text-lg font-bold" style={{ color: 'var(--amber)' }}>{health.lowStockCount}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((health.lowStockCount || 0) / 15 * 100))}%`, background: 'var(--amber)' }} />
          </div>
          <div className="mt-1.5 text-[11px] text-muted">
            {health.lowStockCount > 0 ? `${Math.min(health.lowStockCount, 3)} sản phẩm sắp hết` : 'Tồn kho ổn định'}
          </div>
        </div>
      </div>
    </>
  )
}
