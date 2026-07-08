'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Phone, MapPin, Calendar, FileText } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'
import { getStoreTypeLabel } from '@/lib/constants'
import { getStoreTypeClass } from '@/components/store/store-card'
import { formatDistance } from '@/helper/validation'
import { getRecentStoreOrders } from '@/api/inventory/inventory-client'

const CallSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const EditSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const MapSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
)

const OrderSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
)

const ReportSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
)

const NavigateSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

const HistorySvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

function Row({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[color:var(--muted)] shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] text-[color:var(--muted)]">{label}</div>
        <div className="text-[13px] text-[color:var(--fg)] break-words">{value}</div>
      </div>
    </div>
  )
}

export default function StoreDetailSheet({ store, open, onOpenChange }) {
  const { user, isAdmin } = useAuth() || {}
  const [recentOrders, setRecentOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open || !store?.id) return
    let cancelled = false
    setOrdersLoading(true)
    getRecentStoreOrders(store.id, 5)
      .then((orders) => { if (!cancelled) setRecentOrders(orders) })
      .catch(() => { if (!cancelled) setRecentOrders([]) })
      .finally(() => { if (!cancelled) setOrdersLoading(false) })
    return () => { cancelled = true }
  }, [open, store?.id])

  if (!store || !open) return null

  const typeMeta = getStoreTypeMeta(store.store_type)
  const typeLabel = getStoreTypeLabel(store.store_type)
  const phone = String(store.phone || '').trim()
  const phone2 = String(store.phone_secondary || '').trim()
  const distVal = store.distance
  const addressDetail = store.address_detail || ''

  const appMapHref = store.latitude && store.longitude
    ? `/map?storeId=${store.id}&lat=${store.latitude}&lng=${store.longitude}`
    : null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[55] opacity-100 pointer-events-auto transition-opacity duration-250" onClick={() => onOpenChange(false)} />
      <div className="fixed bottom-0 left-0 right-0 bg-[color:var(--surface)] rounded-t-lg z-60 max-h-[85vh] overflow-y-auto translate-y-0 opacity-100 pointer-events-auto transition-[transform,opacity] duration-300 ease p-0">
        {/* drag handle */}
        <div className="pt-2.5 text-center">
          <div className="w-9 h-1 bg-[color:var(--border)] rounded-sm mx-auto" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between gap-2 px-4 pb-2">
          <h3 className="text-[18px] font-bold flex items-center gap-3 min-w-0 flex-1">
            <span className="shrink-0">{typeMeta.icon}</span>
            <span className="truncate">{store.name}</span>
          </h3>
          <button
            onClick={() => onOpenChange(false)}
            className="size-7 rounded-full bg-[color:var(--surface2)] border-none text-[color:var(--muted)] cursor-pointer grid place-items-center text-[16px] shrink-0 hover:text-[color:var(--fg)]"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* badges */}
        <div className="flex gap-1.5 items-center px-4 pb-3.5 flex-wrap">
          <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium ${getStoreTypeClass(store.store_type)}`}>
            {typeLabel}
          </span>
          <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium ${store.active ? 'text-emerald-500 bg-emerald-500/10' : 'text-blue-500 bg-blue-500/10'}`}>
            {store.active ? 'Đã xác thực' : 'Chưa xác thực'}
          </span>
          {distVal != null && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--accent)] whitespace-nowrap bg-[color:var(--accent-glow)] px-2 py-0.5 rounded-full">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {formatDistance(distVal)}
            </span>
          )}
        </div>

        {/* info rows */}
        <div className="px-4 pb-4 flex flex-col gap-2.5">
          <Row
            icon={<MapPin size={14} />}
            label="Khoảng cách"
            value={distVal != null ? formatDistance(distVal) : <span className="text-[color:var(--muted)]">—</span>}
          />
          <Row
            icon={<MapPin size={14} />}
            label="Quận/Huyện"
            value={store.district || <span className="text-[color:var(--muted)]">—</span>}
          />
          <Row
            icon={<MapPin size={14} />}
            label="Xã/Phường"
            value={store.ward || <span className="text-[color:var(--muted)]">—</span>}
          />
          <Row
            icon={<MapPin size={14} />}
            label="Chi tiết"
            value={addressDetail || <span className="text-[color:var(--muted)]">—</span>}
          />
          <Row
            icon={<Phone size={14} />}
            label="Số điện thoại"
            value={phone || <span className="text-[color:var(--muted)]">—</span>}
          />
          {phone2 && (
            <Row
              icon={<Phone size={14} />}
              label="SĐT 2"
              value={phone2}
            />
          )}
          <Row
            icon={<Calendar size={14} />}
            label="Ngày tạo"
            value={store.created_at ? new Date(store.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : <span className="text-[color:var(--muted)]">—</span>}
          />

          {/* Note */}
          <Row
            icon={<FileText size={14} />}
            label="Ghi chú"
            value={store.note || <span className="text-[color:var(--muted)]">—</span>}
          />

          {/* Recent orders */}
          <div className="pt-1">
            <div className="text-[11px] text-[color:var(--muted)] mb-2 flex items-center gap-1">
              <FileText size={13} />
              Đơn hàng gần đây
            </div>
            {ordersLoading ? (
              <div className="flex flex-col gap-1.5">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center justify-between px-3 py-2.5 rounded-md bg-[color:var(--surface2)]/40 animate-pulse">
                    <div className="h-3 w-24 rounded bg-[color:var(--border)]" />
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-12 rounded bg-[color:var(--border)]" />
                      <div className="h-3 w-16 rounded bg-[color:var(--border)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="transition-opacity duration-300 ease">
                {recentOrders.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {recentOrders.map((order) => (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="flex items-center justify-between px-3 py-2 rounded-md bg-[color:var(--surface2)]/50 hover:bg-[color:var(--surface2)] transition-colors no-underline"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[12px] font-medium text-[color:var(--fg)]">{order.code}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[12px] text-[color:var(--muted)]">
                            {new Date(order.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                          </span>
                          <span className="text-[12px] font-medium text-[color:var(--fg)]">
                            {new Intl.NumberFormat('vi-VN').format(order.total_amount || 0)}đ
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 rounded-lg bg-[color:var(--surface2)]/40 border border-dashed border-[color:var(--border)]">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[color:var(--muted)]/40 mb-2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <p className="text-[12px] text-[color:var(--muted)]/50 font-medium">Chưa có đơn hàng nào</p>
                    <p className="text-[11px] text-[color:var(--muted)]/35 mt-0.5">Đơn hàng sẽ xuất hiện tại đây</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* action buttons */}
        <div className="px-4 pb-5 flex gap-1.5 flex-wrap">
          <a href={phone ? `tel:${phone}` : undefined} className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]${!phone ? ' opacity-40 pointer-events-none' : ''}`} tabIndex={phone ? undefined : -1} aria-disabled={!phone}>
            <CallSvg /> Gọi
          </a>
          {isAdmin ? (
            <Link href={`/store/edit/${store.id}`} className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]">
              <EditSvg /> Sửa
            </Link>
          ) : (
            <Link href={`/store/edit/${store.id}?mode=supplement`} className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]">
              <EditSvg /> Bổ sung
            </Link>
          )}
          <a
            href={store.latitude && store.longitude ? `https://www.google.com/maps?q=${store.latitude},${store.longitude}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]${!store.latitude || !store.longitude ? ' opacity-30 pointer-events-none' : ''}`}
            tabIndex={store.latitude && store.longitude ? undefined : -1}
            aria-disabled={!store.latitude || !store.longitude}
          >
            <NavigateSvg /> Dẫn đường
          </a>
          <Link href={`/orders/new?storeId=${store.id}`} className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]">
            <OrderSvg /> Lên đơn
          </Link>
          {appMapHref && (
            <Link href={appMapHref} className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]">
              <MapSvg /> Xem bản đồ
            </Link>
          )}
          {!isAdmin && (
            <Link href={`/store/report/${store.id}`} className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]">
              <ReportSvg /> Báo cáo
            </Link>
          )}
          {isAdmin && (
            <Link href={`/store/history/${store.id}`} className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]">
              <HistorySvg /> Lịch sử
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
