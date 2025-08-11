import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'
import Image from 'next/image'

function StoreResultCardBase({ store: s, isSelected, onAdd }) {
  const hasCoords = typeof s.latitude === 'number' && typeof s.longitude === 'number'

  if (s.image_url) {
    return (
      <Card>
        <CardContent className="flex items-center gap-4 p-3">
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" aria-label="Xem ảnh lớn" className="shrink-0 cursor-zoom-in">
                <Image
                  src={s.image_url}
                  alt={s.name}
                  width={64}
                  height={64}
                  sizes="64px"
                  quality={70}
                  className="h-16 w-16 rounded object-cover ring-1 ring-gray-200 dark:ring-gray-800"
                />
              </button>
            </DialogTrigger>
            <DialogContent className="overflow-hidden p-0">
              <DialogClose asChild>
                <Image
                  src={s.image_url}
                  alt={s.name}
                  width={800}
                  height={800}
                  title="Bấm vào ảnh để đóng"
                  draggable={false}
                  className="max-h-[80vh] w-auto cursor-zoom-out object-contain"
                />
              </DialogClose>
            </DialogContent>
          </Dialog>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col items-start gap-1">
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs ${s.status ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
              >
                {s.status ? 'Đã xác thực' : 'Chưa xác thực'}
              </span>
              <h3 className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100 break-words">
                <span className="block">Cửa hàng: {s.name}</span>
              </h3>
            </div>
            <p className="truncate text-sm text-gray-600 dark:text-gray-400">Địa chỉ: {s.address}</p>
            {s.phone && (
              <p className="text-sm text-gray-600 dark:text-gray-400">Số điện thoại: {s.phone}</p>
            )}
            {s.note && (
              <p className="text-sm text-gray-600 dark:text-gray-400">Ghi chú: {s.note}</p>
            )}
            {typeof s.distance === 'number' ? (
              <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">Khoảng cách: {s.distance.toFixed(1)} km</p>
            ) : (
              <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">Khoảng cách: Không xác định</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {hasCoords && (
                <Button asChild variant="secondary" size="sm">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Maps
                  </a>
                </Button>
              )}
              <span className="ml-auto">
                {isSelected ? (
                  <Button size="sm" variant="secondary" disabled>
                    Đã thêm
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => { onAdd?.(s) }}>
                    Thêm
                  </Button>
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-3">
        <div className="flex h-16 w-16 items-center justify-center rounded bg-gray-100 text-gray-400 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-800">
          🏬
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col items-start gap-1">
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-xs ${s.status ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
            >
              {s.status ? 'Đã xác thực' : 'Chưa xác thực'}
            </span>
            <h3 className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100 break-words">
              <span className="block">Cửa hàng: {s.name}</span>
            </h3>
          </div>
          <p className="truncate text-sm text-gray-600 dark:text-gray-400">Địa chỉ: {s.address}</p>
          {s.phone && (
            <p className="text-sm text-gray-600 dark:text-gray-400">Số điện thoại: {s.phone}</p>
          )}
          {s.note && (
            <p className="text-sm text-gray-600 dark:text-gray-400">Ghi chú: {s.note}</p>
          )}
          {typeof s.distance === 'number' ? (
            <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">Khoảng cách: {s.distance.toFixed(1)} km</p>
          ) : (
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">Khoảng cách: Không xác định</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {hasCoords && (
              <Button asChild variant="secondary" size="sm">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Maps
                </a>
              </Button>
            )}
            <span className="ml-auto">
              {isSelected ? (
                <Button size="sm" variant="secondary" disabled>
                  Đã thêm
                </Button>
              ) : (
                <Button size="sm" onClick={() => onAdd?.(s)}>
                  Thêm
                </Button>
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const StoreResultCard = memo(StoreResultCardBase)
export default StoreResultCard
