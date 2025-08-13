import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'
import Image from 'next/image'
import { getFullImageUrl } from '@/helper/imageUtils'

function StoreResultCardBase({ store: s, isSelected, onAdd, searchTerm, highlightText }) {
  const hasCoords = typeof s.latitude === 'number' && typeof s.longitude === 'number'
  
  // Status labels
  const STATUS_LABELS = {
    active: 'Xác thực',
    inactive: 'Chưa xác thực'
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                {/* Store Name */}
                <div className="flex items-start gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                      {highlightText && searchTerm ? highlightText(s.name, searchTerm) : s.name}
                    </h3>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                      s.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {s.status === 'active' ? STATUS_LABELS.active : STATUS_LABELS.inactive}
                    </span>
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="leading-tight">{s.address}</span>
                </div>

                {/* Phone */}
                {s.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a 
                      href={`tel:${String(s.phone).replace(/[^0-9+]/g, '')}`} 
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {s.phone}
                    </a>
                  </div>
                )}

                {/* Distance */}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {typeof s.distance === 'number' ? (
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      {s.distance.toFixed(1)} km
                    </span>
                  ) : (
                    <span className="text-sm text-amber-600 dark:text-amber-400">
                      Không xác định
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                {isSelected ? (
                  <Button size="sm" variant="secondary" disabled className="flex items-center gap-2 px-3 h-10">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm">Đã thêm</span>
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => onAdd?.(s)} className="flex items-center gap-2 px-3 h-10">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="text-sm">Thêm</span>
                  </Button>
                )}
                {hasCoords && (
                  <Button asChild variant="outline" size="sm" className="flex items-center gap-2 px-3 h-10">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&travelmode=driving`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm">Maps</span>
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      
      {/* Dialog with full information */}
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <div className="flex flex-col md:flex-row max-h-[90vh]">
          {/* Store Image or Placeholder - Left Side */}
          <div className="flex-shrink-0 w-full md:w-1/2">
            {s.image_url ? (
              <Image
                src={getFullImageUrl(s.image_url)}
                alt={s.name}
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
          </div>
          
          {/* Store Information - Right Side */}
          <div className="flex-1 p-4 md:p-6 flex flex-col overflow-y-auto">
            <div className="flex-1 space-y-3 md:space-y-4">
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
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 flex-shrink-0 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Điện thoại:
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
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Trạng thái:
                    </span>
                    <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                      s.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                    }`}>
                      {s.status === 'active' ? STATUS_LABELS.active : STATUS_LABELS.inactive}
                    </span>
                  </div>
                )}
                
                {typeof s.distance === 'number' && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Khoảng cách:
                    </span>
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      {s.distance.toFixed(1)} km
                    </span>
                  </div>
                )}
                
                {s.note && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Ghi chú:
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      {s.note}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 md:gap-3 pt-4 md:pt-6 border-t border-gray-200 dark:border-gray-700 mt-4 md:mt-6 flex-shrink-0">
              {!isSelected && (
                <Button onClick={() => onAdd?.(s)} className="flex-1 h-10 md:h-12">
                  <div className="flex items-center justify-center gap-2 md:gap-3">
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="text-sm md:text-base font-medium">Thêm vào danh sách</span>
                  </div>
                </Button>
              )}
              {isSelected && (
                <Button variant="secondary" disabled className="flex-1 h-10 md:h-12">
                  <div className="flex items-center justify-center gap-2 md:gap-3">
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm md:text-base font-medium">Đã thêm</span>
                  </div>
                </Button>
              )}
              {hasCoords && (
                <Button asChild variant="outline" className="flex-1 h-10 md:h-12">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 md:gap-3"
                  >
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm md:text-base font-medium">Chỉ đường</span>
                  </a>
                </Button>
              )}
              <DialogClose asChild>
                <Button variant="outline" className={`h-10 md:h-12 ${!isSelected && hasCoords ? "flex-1" : hasCoords || isSelected ? "flex-1" : "w-full"}`}>
                  <div className="flex items-center justify-center gap-2 md:gap-3">
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-sm md:text-base font-medium">Đóng</span>
                  </div>
                </Button>
              </DialogClose>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const StoreResultCard = memo(StoreResultCardBase)
export default StoreResultCard
