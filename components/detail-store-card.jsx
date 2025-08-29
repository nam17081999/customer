import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'
import Image from 'next/image'
import Link from 'next/link'
import { getFullImageUrl } from '@/helper/imageUtils'

export function DetailStoreModalContent({ store, context = 'search', onAdd, isAdded, onRemove }) {
  if (!store) return null
  const hasCoords = typeof store.latitude === 'number' && typeof store.longitude === 'number'
  const status = store.status || (store.active ? 'active' : null)
  const formatDistance = (d) => {
    if (d === null || d === undefined) return ''
    return d < 1 ? `${(d * 1000).toFixed(0)} m` : `${d.toFixed(1)} km`
  }

  const handleAdd = () => { if (!isAdded && onAdd) onAdd(store) }
  const handleRemove = () => { if (onRemove) onRemove(store.id) }

  const ActionSection = () => (
    <div className="flex-shrink-0 pt-4 md:pt-6 border-t border-gray-200 dark:border-gray-700 mt-4 md:mt-6">
      {/* Mobile (2 buttons per row) */}
      <div className="sm:hidden">
        <div className="grid grid-cols-2 gap-2">
          {context === 'search' && (
            <Button onClick={handleAdd} disabled={isAdded} className="w-full h-11 text-sm">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" /></svg>
              {isAdded ? 'Đã thêm' : 'Thêm'}
            </Button>
          )}
          {context === 'list' && onRemove && (
            <Button variant="outline" onClick={handleRemove} className="w-full h-11 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Loại bỏ
            </Button>
          )}
          {hasCoords && (
            <Button asChild variant="outline" className="w-full h-11 text-sm">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}&travelmode=driving`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" /></svg>
                Bản đồ
              </a>
            </Button>
          )}
          <Button asChild variant="outline" className="w-full h-11 text-sm">
            <Link href={`/store/${store.id}`} className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Sửa
            </Link>
          </Button>
          <DialogClose asChild>
            <Button variant="outline" className="w-full h-11 text-sm">
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Đóng
              </div>
            </Button>
          </DialogClose>
        </div>
      </div>
      {/* Desktop */}
      <div className="hidden sm:flex gap-3">
        {context === 'search' && (
          <Button onClick={handleAdd} disabled={isAdded} className="flex-1 h-12">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" /></svg>
            {isAdded ? 'Đã thêm' : 'Thêm'}
          </Button>
        )}
        {context === 'list' && onRemove && (
          <Button
            variant="outline"
            onClick={handleRemove}
            className="flex-1 h-12 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Loại bỏ
          </Button>
        )}
        {hasCoords && (
          <Button asChild variant="outline" className="flex-1 h-12">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}&travelmode=driving`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" /></svg>
              Bản đồ
            </a>
          </Button>
        )}
        <Button asChild variant="outline" className="flex-1 h-12">
          <Link href={`/store/${store.id}`} className="flex items-center justify-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Sửa
          </Link>
        </Button>
        <DialogClose asChild>
          <Button variant="outline" className="flex-1 h-12">
            <div className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Đóng
            </div>
          </Button>
        </DialogClose>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col md:flex-row max-h-[90vh]">
      <div className="flex-shrink-0 w-full md:w-1/2 relative">
        {store.image_url ? (
          <Image
            src={getFullImageUrl(store.image_url)}
            alt={store.name}
            width={500}
            height={400}
            className="w-full h-48 md:h-96 object-contain bg-gray-100 dark:bg-gray-800"
          />
        ) : (
          <div className="w-full h-48 md:h-96 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <svg className="w-16 h-16 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {typeof store.distance === 'number' && (
          <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/90 dark:bg-gray-900/80 text-gray-700 dark:text-gray-200 shadow">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            {formatDistance(store.distance)}
          </div>
        )}
      </div>
      <div className="flex-1 p-4 md:p-6 flex flex-col overflow-y-auto">
        <div className="flex-1 space-y-3 md:space-y-4">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{store.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{store.address}</p>
          </div>
          <div className="space-y-3">
            {store.phone && (
              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 flex-shrink-0 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <span className="hidden sm:inline">Điện thoại:</span>
                </span>
                <a href={`tel:${String(store.phone).replace(/[^0-9+]/g,'')}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all">{store.phone}</a>
              </div>
            )}
            {status && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  <span className="hidden sm:inline">Trạng thái:</span>
                </span>
                <span className={`text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full font-medium ${status==='active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'}`}>{status==='active' ? 'Xác thực' : 'Chưa xác thực'}</span>
              </div>
            )}
            {typeof store.distance === 'number' && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" /></svg>
                  <span className="hidden sm:inline">Khoảng cách:</span>
                </span>
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{formatDistance(store.distance)}</span>
              </div>
            )}
            {store.note && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  <span className="hidden sm:inline">Ghi chú:</span>
                </span>
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{store.note}</span>
              </div>
            )}
          </div>
        </div>
        <ActionSection />
      </div>
    </div>
  )
}

export default function DetailStoreCard({ 
  store: s, 
  isSelected, 
  onAdd, 
  onRemove,
  item,
  dragAttributes, 
  dragListeners,
  isAdded,
}) {
  const storeData = s || item
  const hasCoords = typeof storeData.latitude === 'number' && typeof storeData.longitude === 'number'
  const formatDistance = (d) => {
    if (d === null || d === undefined) return ''
    return d < 1 ? `${(d * 1000).toFixed(0)} m` : `${d.toFixed(1)} km`
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-3 p-3">
            {dragAttributes && dragListeners && (
              <button
                type="button"
                aria-label="Kéo để sắp xếp"
                {...dragAttributes}
                {...dragListeners}
                onClick={(e) => e.stopPropagation()}
                className="flex h-8 shrink-0 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none select-none opacity-70 hover:opacity-100 focus:outline-none focus:ring-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M7 5a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM7 15a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>
            )}
            <div className="min-w-0 flex-1">
              {typeof storeData.distance === 'number' && (
                <div className="mb-1">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    {formatDistance(storeData.distance)}
                  </span>
                </div>
              )}
              <div className="truncate text-base font-medium text-gray-900 dark:text-gray-100">{storeData.name}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 leading-tight">{storeData.address}</div>
              {storeData.phone && (
                <div className="truncate text-sm text-gray-600 dark:text-gray-400">
                  SĐT:{' '}
                  <a
                    href={`tel:${String(storeData.phone).replace(/[^0-9+]/g, '')}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {storeData.phone}
                  </a>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {hasCoords && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 w-8 p-0 shrink-0"
                >
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${storeData.latitude},${storeData.longitude}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Chỉ đường"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" /></svg>
                  </a>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onRemove?.(storeData.id) }}
                className="h-8 w-8 p-0 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                aria-label="Xóa khỏi danh sách"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DetailStoreModalContent store={storeData} context="list" onRemove={onRemove} />
      </DialogContent>
    </Dialog>
  )
}
