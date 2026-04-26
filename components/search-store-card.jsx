import { useState } from 'react'
import { useRouter } from 'next/router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'
import { hasStoreCoordinates } from '@/helper/storeSupplement'
import StoreDetailModal from '@/components/store-detail-modal'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'
import TelesaleCallDialog from '@/components/store/telesale-call-dialog'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'
import { DirectionTurnIcon } from '@/components/icons/navigation-icons'

function CircleIconButton({ href, label, children, onClick, onPointerDown }) {
  const className = 'flex h-10 w-10 items-center justify-center rounded-full border border-gray-800 bg-gray-800 text-gray-400 transition'
  const isLink = Boolean(href)
  const isExternal = isLink && /^https?:/i.test(href)

  if (isLink) {
    return (
      <a
        href={href}
        aria-label={label}
        title={label}
        className={className}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noreferrer' : undefined}
        onPointerDown={(event) => {
          event.stopPropagation()
          onPointerDown?.(event)
        }}
        onClick={(event) => {
          event.stopPropagation()
          onClick?.(event)
        }}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={className}
      onPointerDown={(event) => {
        event.stopPropagation()
        onPointerDown?.(event)
      }}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
    >
      {children}
    </button>
  )
}

export default function SearchStoreCard({
  store,
  distance,
  searchTerm,
  compact,
  compactActionLabel = '',
  onCompactAction,
}) {
  const router = useRouter()
  const [detailOpen, setDetailOpen] = useState(false)
  const addressText = formatAddressParts(store)
  const hasCoordinates = hasStoreCoordinates(store)
  const typeMeta = getStoreTypeMeta(store.store_type)
  const directionHref = hasCoordinates ? `https://www.google.com/maps?q=${store.latitude},${store.longitude}` : ''
  const hasAnyPhone = Boolean(String(store.phone || '').trim() || String(store.phone_secondary || '').trim())

  const handleCompactAction = (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (typeof onCompactAction === 'function') {
      onCompactAction(store, router)
    }
  }

  const handleOpenDetail = () => {
    setDetailOpen(true)
  }

  const renderHighlightedName = (name, term) => {
    const text = name || ''
    const q = (term || '').trim()
    if (!q) return text
    const normText = removeVietnameseTones(text).toLowerCase()
    const normQ = removeVietnameseTones(q).toLowerCase()
    if (!normQ) return text

    const ranges = []
    let start = 0
    while (start <= normText.length - normQ.length) {
      const idx = normText.indexOf(normQ, start)
      if (idx === -1) break
      ranges.push([idx, idx + normQ.length])
      start = idx + normQ.length
    }
    if (ranges.length === 0) return text

    const parts = []
    let lastEnd = 0
    ranges.forEach(([s, e], i) => {
      if (s > lastEnd) parts.push(text.slice(lastEnd, s))
      parts.push(
        <mark key={`hl-${i}`} className="bg-yellow-200 dark:bg-yellow-700 -md px-0.5">
          {text.slice(s, e)}
        </mark>,
      )
      lastEnd = e
    })
    if (lastEnd < text.length) parts.push(text.slice(lastEnd))
    return parts
  }

  if (compact) {
    return (
      <>
        <Card className="overflow-hidden rounded-md border border-gray-800 bg-gray-950 transition duration-200 hover:shadow-md">
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_auto] gap-2 p-3">
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={handleOpenDetail}
              >
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                  <div className="flex h-6 w-6 items-center justify-center text-sky-300">
                    {typeMeta.icon}
                  </div>

                  <div className="min-w-0">
                    <OverflowMarquee
                      className="max-w-full"
                      textClassName="font-semibold text-gray-100 text-lg leading-snug"
                      contentKey={`${store.id}:${store.name}:${searchTerm || ''}`}
                    >
                      {renderHighlightedName(store.name, searchTerm)}
                    </OverflowMarquee>
                  </div>

                  <div className="col-span-2 mt-1 space-y-1">
                    {distance !== null && distance !== undefined ? (
                      <span className="inline-flex items-center gap-1 leading-none text-base text-gray-400">
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="leading-none">{formatDistance(distance)}</span>
                      </span>
                    ) : !hasCoordinates ? (
                      <span className="inline-flex items-center gap-1 leading-none text-base text-amber-400">
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21c4.97-4.97 7-8.25 7-11a7 7 0 10-14 0c0 2.75 2.03 6.03 7 11z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
                        </svg>
                        <span className="leading-none">Chưa có vị trí</span>
                      </span>
                    ) : null}

                    <p className="text-base text-gray-400 line-clamp-2 leading-snug">{addressText}</p>
                  </div>
                </div>
              </button>

              <div className="flex shrink-0 flex-col justify-center gap-2">
                {hasCoordinates && (
                  <CircleIconButton href={directionHref} label="Chỉ đường">
                    <DirectionTurnIcon className="h-6 w-6" />
                  </CircleIconButton>
                )}
                {hasAnyPhone && (
                  <TelesaleCallDialog
                    store={store}
                    trigger={(
                      <CircleIconButton label="Gọi điện">
                        <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.56 1 1 0 01-.24 1.01l-1.71 1.72z"></path>
                        </svg>
                      </CircleIconButton>
                    )}
                  />
                )}
              </div>
            </div>

            {compactActionLabel && typeof onCompactAction === 'function' && (
              <div className="px-3 pb-3 pt-0">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3 text-sm"
                  onClick={handleCompactAction}
                >
                  {compactActionLabel}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <StoreDetailModal store={store} open={detailOpen} onOpenChange={setDetailOpen} />
      </>
    )
  }

  return (
    <>
      <Card className="overflow-hidden rounded-md border border-gray-800 bg-gray-950 transition duration-200 hover:shadow-lg">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <button
              type="button"
              className="flex min-w-0 flex-1 gap-4 text-left"
              onClick={handleOpenDetail}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center text-sky-300">
                {typeMeta.icon}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-100 text-lg md:text-xl leading-tight break-words">
                  {renderHighlightedName(store.name, searchTerm)}
                </h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  {distance !== null && distance !== undefined ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-0.5 text-xs font-medium text-gray-200 shadow">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {formatDistance(distance)}
                    </span>
                  ) : !hasCoordinates ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-950/80 px-2 py-0.5 text-xs font-medium text-amber-200 shadow">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21c4.97-4.97 7-8.25 7-11a7 7 0 10-14 0c0 2.75 2.03 6.03 7 11z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
                      </svg>
                      Chưa có vị trí
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-1 text-base leading-snug text-gray-300 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.105 0 2-.893 2-1.995A2 2 0 0012 7a2 2 0 00-2 2.005C10 10.107 10.895 11 12 11z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1114 0z" />
                    </svg>
                    <p className="line-clamp-3 break-words flex-1">{addressText}</p>
                  </div>

                  {store.note && (
                    <div className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4h5l5 5v7a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 4v6h6" />
                      </svg>
                      <p className="line-clamp-3 break-words flex-1">{store.note}</p>
                    </div>
                  )}
                </div>
              </div>
            </button>

            <div className="flex shrink-0 items-start gap-2">
              {hasCoordinates && (
                <CircleIconButton href={directionHref} label="Chỉ đường">
                  <DirectionTurnIcon className="h-6 w-6" />
                </CircleIconButton>
              )}
              {hasAnyPhone && (
                <TelesaleCallDialog
                  store={store}
                  trigger={(
                    <CircleIconButton label="Gọi điện">
                      <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.56 1 1 0 01-.24 1.01l-1.71 1.72z"></path>
                      </svg>
                    </CircleIconButton>
                  )}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <StoreDetailModal store={store} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  )
}
