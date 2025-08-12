import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'
import Image from 'next/image'
import { getFullImageUrl } from '@/helper/imageUtils'

function SelectedStoreItemBase({ item: s, dragAttributes, dragListeners, onRemove }) {
  const hasCoords = typeof s.latitude === 'number' && typeof s.longitude === 'number'

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-3 p-3">
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
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {s.name}
              </div>
              <div className="truncate text-xs text-gray-600 dark:text-gray-400">{s.address}</div>
              {/* Added clickable phone */}
              {s.phone && (
                <div className="truncate text-xs text-gray-600 dark:text-gray-400">
                  SĐT:{' '}
                  <a
                    href={`tel:${String(s.phone).replace(/[^0-9+]/g, '')}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {s.phone}
                  </a>
                </div>
              )}
              {typeof s.distance === 'number' ? (
                <div className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">Khoảng cách: {s.distance.toFixed(1)} km</div>
              ) : s.distance === null ? (
                <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">Khoảng cách: Không xác định</div>
              ) : null}
            </div>
            <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {hasCoords && (
                <Button asChild size="sm" variant="secondary">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Maps
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onRemove?.(s.id)}>
                Bỏ
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Store Image or Placeholder - Left Side */}
          <div className="flex-shrink-0 w-full md:w-1/2">
            {s.image_url ? (
              <Image
                src={getFullImageUrl(s.image_url)}
                alt={s.name}
                width={500}
                height={400}
                className="w-full h-64 md:h-96 object-contain bg-gray-100 dark:bg-gray-800"
              />
            ) : (
              <div className="w-full h-64 md:h-96 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <svg className="w-16 h-16 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
          
          {/* Store Information - Right Side */}
          <div className="flex-1 p-6 flex flex-col">
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {s.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {s.address}
                </p>
              </div>
              
              <div className="space-y-3">
                {s.phone && (
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 flex-shrink-0">
                      📞 Điện thoại:
                    </span>
                    <a
                      href={`tel:${String(s.phone).replace(/[^0-9+]/g, '')}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {s.phone}
                    </a>
                  </div>
                )}
                
                {s.status && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
                      🏪 Trạng thái:
                    </span>
                    <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                      s.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                    }`}>
                      {s.status === 'active' ? 'Hoạt động' : 'Không hoạt động'}
                    </span>
                  </div>
                )}
                
                {typeof s.distance === 'number' && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
                      📍 Khoảng cách:
                    </span>
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      {s.distance.toFixed(1)} km
                    </span>
                  </div>
                )}
                
                {s.note && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      📝 Ghi chú:
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      {s.note}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
              {hasCoords && (
                <Button asChild className="flex-1">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🗺️ Chỉ đường
                  </a>
                </Button>
              )}
              <DialogClose asChild>
                <Button variant="outline" className="flex-1">
                  ✕ Đóng
                </Button>
              </DialogClose>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const SelectedStoreItem = memo(SelectedStoreItemBase)
export default SelectedStoreItem
