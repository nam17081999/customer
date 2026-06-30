'use client'
import { useEffect } from 'react'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'
import { getStoreTypeLabel } from '@/lib/constants'
import { getStoreTypeClass } from '@/components/store/store-card'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'

export default function StoreDetailModalSimple({ store, open, onOpenChange }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) onOpenChange(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

  if (!store || !open) return null

  const typeMeta = getStoreTypeMeta(store.store_type)
  const typeLabel = getStoreTypeLabel(store.store_type)
  const addressText = formatAddressParts(store)
  const phone = String(store.phone || '').trim()
  const phone2 = String(store.phone_secondary || '').trim()
  const distVal = store.distance

  return (
    <div className="dt-modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false) }}>
      <div className="dt-modal">
        <div className="dt-modal-header">
          <h3 className="detail-name">
            <span className="store-type-icon">{typeMeta.icon}</span>
            <span className="truncate">{store.name}</span>
          </h3>
          <button className="dt-modal-close" onClick={() => onOpenChange(false)} aria-label="Đóng">✕</button>
        </div>
        <div className="dt-modal-body">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
            <span className={`store-card-type ${getStoreTypeClass(store.store_type)}`}>
              {typeLabel}
            </span>
            <span className={`store-card-type ${store.active ? 'store-type-tap-hoa' : 'store-type-kho'}`}>
              {store.active ? 'Đã xác thực' : 'Chưa xác thực'}
            </span>
          </div>
          <div className="dt-row">
            <div>
              <div className="dt-label">Khoảng cách</div>
              <div className="dt-value">
                {distVal != null ? `${formatDistance(distVal)} · ${store.district || ''}` : '—'}
              </div>
            </div>
            <div>
              <div className="dt-label">Xã/Phường</div>
              <div className="dt-value">{store.ward || '—'}</div>
            </div>
          </div>
          <div className="dt-row">
            <div>
              <div className="dt-label">Địa chỉ</div>
              <div className="dt-value">{addressText || '—'}</div>
            </div>
            <div>
              <div className="dt-label">SĐT</div>
              <div className="dt-value">{phone || '—'}</div>
            </div>
          </div>
          <div className="dt-row">
            <div>
              <div className="dt-label">SĐT 2</div>
              <div className="dt-value">{phone2 || <span className="dt-empty">—</span>}</div>
            </div>
            <div>
              <div className="dt-label">Ngày tạo</div>
              <div className="dt-value">{store.created_at ? new Date(store.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</div>
            </div>
          </div>
          <div className="dt-row">
            <div>
              <div className="dt-label">Tổng đơn</div>
              <div className="dt-value">—</div>
            </div>
          </div>
          <div className="dt-section-title">Ghi chú</div>
          <div className="dt-value">{store.note || <span className="dt-empty">—</span>}</div>
          <div className="dt-section-title">Đơn hàng gần đây</div>
          <div className="order-empty">Chưa có đơn hàng</div>
        </div>
        <div className="dt-modal-footer">
          <button className="btn btn-outline" onClick={() => onOpenChange(false)}>Đóng</button>
        </div>
      </div>
    </div>
  )
}
