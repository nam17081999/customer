'use client'
import { memo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'
import { getStoreTypeLabel } from '@/lib/constants'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'

export function getStoreTypeClass(storeType) {
  const map = {
    tap_hoa: 'text-emerald-500 bg-emerald-500/10',
    quan_an: 'text-orange-500 bg-orange-500/10',
    kho: 'text-blue-500 bg-blue-500/10',
    karaoke: 'text-purple-500 bg-purple-500/10',
    khach_san: 'text-red-500 bg-red-500/10',
    game: 'text-amber-500 bg-amber-500/10',
  }
  return map[storeType] || 'text-emerald-500 bg-emerald-500/10'
}

const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const CallIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const NavigateIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

const ReportIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
)

function StoreCard({ store, distance, onOpenDetail }) {
  const { user, isAdmin } = useAuth() || {}
  const addressText = formatAddressParts(store)
  const typeMeta = getStoreTypeMeta(store.store_type)
  const typeLabel = getStoreTypeLabel(store.store_type)
  const phone = String(store.phone || '').trim()
  const distVal = distance != null ? distance : store.distance

  return (
    <div
      className="flex flex-col bg-[color:var(--surface)] border border-[color:var(--border)] rounded p-4 cursor-pointer outline-none touch-manipulation"
      tabIndex={0}
      role="button"
      onClick={() => onOpenDetail(store)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(store) } }}
    >
      <div className="flex justify-between items-start gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 min-w-0 overflow-hidden text-[18px] font-semibold">
            <span className="shrink-0">{typeMeta.icon}</span>
            <span className="truncate">{store.name}</span>
          </div>
          <div className="flex gap-1.5 items-center mt-1.5 flex-wrap">
            <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium ${getStoreTypeClass(store.store_type)}`}>
              {typeLabel}
            </span>
            <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium ${store.active ? 'text-emerald-500 bg-emerald-500/10' : 'text-blue-500 bg-blue-500/10'}`}>
              {store.active ? 'Đã xác thực' : 'Chưa xác thực'}
            </span>
            {distVal != null && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--accent)] whitespace-nowrap bg-[color:var(--accent-glow)] px-2 py-0.5 rounded-full shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {formatDistance(distVal)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 mb-3 flex-1">
        {addressText && (
          <div className="flex items-center gap-1.5 text-[13px] text-[color:var(--muted)]">
            <span className="shrink-0"><PinIcon /></span>
            <span className="truncate">{addressText}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[13px] text-[color:var(--muted)]">
          <span className="shrink-0"><PhoneIcon /></span>
          <span>{phone || 'Chưa có số'}</span>
        </div>
      </div>
      <div className="flex gap-1.5 mt-auto pt-3 border-t border-[color:var(--border)] flex-wrap" onClick={(e) => e.stopPropagation()}>
            <a href={phone ? `tel:${phone}` : undefined} className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]${!phone ? ' opacity-40 pointer-events-none' : ''}`} tabIndex={phone ? undefined : -1} aria-disabled={!phone}>
          <CallIcon /> Gọi
        </a>
        <a
          href={store.latitude && store.longitude ? `https://www.google.com/maps?q=${store.latitude},${store.longitude}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]${!store.latitude || !store.longitude ? ' opacity-30 pointer-events-none' : ''}`}
          tabIndex={store.latitude && store.longitude ? undefined : -1}
          aria-disabled={!store.latitude || !store.longitude}
        >
          <NavigateIcon /> Dẫn đường
        </a>
        {user && (isAdmin || user.role === 'telesale') && (
          <Link href={`/orders/new?storeId=${store.id}`} className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            Lên đơn
          </Link>
        )}
        {!isAdmin && (
          <Link href={`/store/report/${store.id}`} className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]">
            <ReportIcon /> Báo cáo
          </Link>
        )}
      </div>
    </div>
  )
}

export default memo(StoreCard)
