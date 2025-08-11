import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'
import Image from 'next/image'

function SelectedStoreItemBase({ item: s, dragAttributes, dragListeners, onRemove }) {
  const hasCoords = typeof s.latitude === 'number' && typeof s.longitude === 'number'

  if (s.image_url) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Card className="cursor-zoom-in">
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
                <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                <div className="truncate text-xs text-gray-600 dark:text-gray-400">{s.address}</div>
                {/* Added clickable phone */}
                {s.phone && (
                  <div className="truncate text-xs text-gray-600 dark:text-gray-400">
                    SĐT:{' '}
                    <a
                      href={`tel:${String(s.phone).replace(/[^0-9+]/g, '')}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-600 hover:underline dark:text-blue-400"
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
    )
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <button
          type="button"
          aria-label="Kéo để sắp xếp"
          {...dragAttributes}
          {...dragListeners}
          className="flex h-8 shrink-0 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none select-none opacity-70 hover:opacity-100 focus:outline-none focus:ring-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M7 5a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM7 15a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
          <div className="truncate text-xs text-gray-600 dark:text-gray-400">{s.address}</div>
          {/* Added clickable phone */}
          {s.phone && (
            <div className="truncate text-xs text-gray-600 dark:text-gray-400">
              SĐT:{' '}
              <a
                href={`tel:${String(s.phone).replace(/[^0-9+]/g, '')}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
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
        <div className="ml-auto flex items-center gap-2">
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
  )
}

const SelectedStoreItem = memo(SelectedStoreItemBase)
export default SelectedStoreItem
