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
    tap_hoa: 'store-type-tap-hoa',
    quan_an: 'store-type-quan-an',
    kho: 'store-type-kho',
    karaoke: 'store-type-karaoke',
    khach_san: 'store-type-khach-san',
    game: 'store-type-game',
  }
  return map[storeType] || 'store-type-tap-hoa'
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

const MapIcon_sm = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
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
      className="store-card"
      tabIndex={0}
      role="button"
      onClick={() => onOpenDetail(store)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(store) } }}
    >
      <div className="store-card-top">
        <div className="min-w-0">
          <div className="store-card-name">
            <span className="store-type-icon shrink-0">{typeMeta.icon}</span>
            <span className="truncate">{store.name}</span>
          </div>
          <div className="store-card-meta">
            <span className={`store-card-type ${getStoreTypeClass(store.store_type)}`}>
              {typeLabel}
            </span>
            <span className={`store-card-type ${store.active ? 'store-type-tap-hoa' : 'store-type-kho'}`}>
              {store.active ? 'Đã xác thực' : 'Chưa xác thực'}
            </span>
          </div>
        </div>
        {distVal != null && (
          <span className="dist-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {formatDistance(distVal)}
          </span>
        )}
      </div>
      <div className="store-card-body">
        {addressText && (
          <div className="store-card-row">
            <PinIcon />
            <span className="truncate">{addressText}</span>
          </div>
        )}
        <div className="store-card-row">
          <PhoneIcon />
          <span>{phone || 'Chưa có số'}</span>
        </div>
      </div>
      <div className="store-card-actions" onClick={(e) => e.stopPropagation()}>
        <a href={phone ? `tel:${phone}` : undefined} className={`btn btn-outline btn-sm${!phone ? ' opacity-40 pointer-events-none' : ''}`} tabIndex={phone ? undefined : -1} aria-disabled={!phone}>
          <CallIcon /> Gọi
        </a>
        {user && (
          <Link href={`/store/edit/${store.id}`} className="btn btn-outline btn-sm">
            <EditIcon /> Sửa
          </Link>
        )}
        <a
          href={store.latitude && store.longitude ? `https://www.google.com/maps?q=${store.latitude},${store.longitude}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn btn-outline btn-sm${!store.latitude || !store.longitude ? ' opacity-30 pointer-events-none' : ''}`}
          tabIndex={store.latitude && store.longitude ? undefined : -1}
          aria-disabled={!store.latitude || !store.longitude}
        >
          <MapIcon_sm /> Bản đồ
        </a>
        {!isAdmin && (
          <Link href={`/store/report/${store.id}`} className="btn btn-outline btn-sm ml-auto">
            <ReportIcon /> Báo cáo
          </Link>
        )}
      </div>
    </div>
  )
}

export default memo(StoreCard)
