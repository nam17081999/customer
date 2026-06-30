'use client'
import { useEffect } from 'react'
import { Phone, MapPin, Calendar, FileText } from 'lucide-react'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'
import { getStoreTypeLabel } from '@/lib/constants'
import { getStoreTypeClass } from '@/components/store/store-card'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'

export default function StoreDetailSheet({ store, open, onOpenChange }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!store || !open) return null

  const typeMeta = getStoreTypeMeta(store.store_type)
  const typeLabel = getStoreTypeLabel(store.store_type)
  const addressText = formatAddressParts(store)
  const phone = String(store.phone || '').trim()
  const phone2 = String(store.phone_secondary || '').trim()
  const distVal = store.distance

  return (
    <>
      <div className="filter-backdrop open" onClick={() => onOpenChange(false)} />
      <div className="filter-sheet open" style={{ padding: 0 }}>
        {/* drag handle */}
        <div style={{ padding: '10px 0 0', textAlign: 'center' }}>
          <div className="sheet-handle" />
        </div>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '0 16px 12px' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>{typeMeta.icon}</span>
            <span className="truncate">{store.name}</span>
          </h3>
          <button
            onClick={() => onOpenChange(false)}
            style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 16, flexShrink: 0 }}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* badges */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '0 16px 14px', flexWrap: 'wrap' }}>
          <span className={`store-card-type ${getStoreTypeClass(store.store_type)}`}>
            {typeLabel}
          </span>
          <span className={`store-card-type ${store.active ? 'store-type-tap-hoa' : 'store-type-kho'}`}>
            {store.active ? 'Đã xác thực' : 'Chưa xác thực'}
          </span>
        </div>

        {/* info rows */}
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row
            icon={<MapPin size={14} />}
            label="Địa chỉ"
            value={addressText || '—'}
          />
          <Row
            icon={<Phone size={14} />}
            label="Số điện thoại"
            value={phone || '—'}
          />
          {phone2 && (
            <Row
              icon={<Phone size={14} />}
              label="SĐT 2"
              value={phone2}
            />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Row
              icon={<MapPin size={14} />}
              label="Quận/Huyện"
              value={store.district || '—'}
            />
            <Row
              icon={<MapPin size={14} />}
              label="Xã/Phường"
              value={store.ward || '—'}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Row
              icon={<MapPin size={14} />}
              label="Khoảng cách"
              value={distVal != null ? formatDistance(distVal) : '—'}
            />
            <Row
              icon={<Calendar size={14} />}
              label="Ngày tạo"
              value={store.created_at ? new Date(store.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
            />
          </div>

          {/* note */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileText size={13} />
              Ghi chú
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.4 }}>{store.note || <span style={{ color: 'var(--muted)' }}>—</span>}</div>
          </div>

          {/* recent orders */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileText size={13} />
              Đơn hàng gần đây
            </div>
            <div className="order-empty">Chưa có đơn hàng</div>
          </div>
        </div>

        {/* action buttons */}
        <div style={{ padding: '12px 16px 20px', display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => onOpenChange(false)}>Đóng</button>
        </div>
      </div>
    </>
  )
}

function Row({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--fg)', wordBreak: 'break-word' }}>{value}</div>
      </div>
    </div>
  )
}
