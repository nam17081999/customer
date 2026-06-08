import { memo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'
import { hasStoreCoordinates } from '@/helper/storeSupplement'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'
import { DirectionTurnIcon } from '@/components/icons/navigation-icons'

const StoreDetailModal = dynamic(() => import('@/components/store-detail-modal'), {
  ssr: false,
})

const TelesaleCallDialog = dynamic(() => import('@/components/store/telesale-call-dialog'), {
  ssr: false,
})

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HighlightedName({ name, term }) {
  const text = name || ''
  const q = (term || '').trim()
  if (!q) return text
  const normText = removeVietnameseTones(text).toLowerCase()
  const normQ = removeVietnameseTones(q).toLowerCase()
  if (!normQ) return text

  const matches = Array.from(normText.matchAll(new RegExp(escapeRegExp(normQ), 'g')))
  if (matches.length === 0) return text

  const parts = []
  let lastEnd = 0
  for (const match of matches) {
    const start = match.index
    const end = start + normQ.length
    if (start > lastEnd) parts.push(text.slice(lastEnd, start))
    parts.push(
      <mark key={`hl-${start}-${end}`} className="bg-yellow-200 dark:bg-yellow-700 rounded-md px-0.5">
        {text.slice(start, end)}
      </mark>,
    )
    lastEnd = end
  }
  if (lastEnd < text.length) parts.push(text.slice(lastEnd))
  return parts
}

function CircleIconButton({ href, label, children, onClick, onPointerDown }) {
  const className = 'flex size-10 items-center justify-center rounded-full transition'
  const isLink = Boolean(href)
  const isExternal = isLink && /^https?:/i.test(href)

    if (isLink) {
    return (
      <a
        href={href}
        aria-label={label}
        title={label}
        className={className}
        style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,15,15,0.6)', color: 'var(--muted)' }}
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
        style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,15,15,0.6)', color: 'var(--muted)' }}
        onFocus={(e) => e.currentTarget.classList.add('focus-visible-ring')}
        onBlur={(e) => e.currentTarget.classList.remove('focus-visible-ring')}
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

function SearchStoreCard({
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

  if (compact) {
    return (
      <>
        <Card className="overflow-hidden rounded-lg transition duration-200" style={{ background: 'var(--surface)' }}>
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_auto] gap-2 p-3">
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={handleOpenDetail}
              >
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                  <div className="flex size-6 items-center justify-center" style={{ color: 'var(--primary)' }}>
                    {typeMeta.icon}
                  </div>

                    <div className="min-w-0">
                      <div className="truncate font-semibold leading-snug text-lg" style={{ color: 'var(--foreground)' }}>
                      <HighlightedName name={store.name} term={searchTerm} />
                    </div>
                  </div>

                    <div className="col-span-2 mt-1 space-y-1">
                    {distance !== null && distance !== undefined ? (
                      <span className="inline-flex h-6 items-center leading-none text-base" style={{ color: 'var(--muted)' }}>
                        <span className="leading-none">{formatDistance(distance)}</span>
                      </span>
                    ) : !hasCoordinates ? (
                      <span className="inline-flex h-6 items-center gap-1 leading-none text-base text-amber-400">
                        <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21c4.97-4.97 7-8.25 7-11a7 7 0 10-14 0c0 2.75 2.03 6.03 7 11z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
                        </svg>
                        <span className="leading-none">Chưa có vị trí</span>
                      </span>
                    ) : null}

                    <p className="line-clamp-2 text-base leading-snug" style={{ color: 'var(--muted)' }}>{addressText}</p>
                  </div>
                </div>
              </button>

              <div className="flex shrink-0 flex-col justify-center gap-2">
                {hasCoordinates && (
                  <CircleIconButton href={directionHref} label="Chỉ đường">
                    <DirectionTurnIcon className="size-6" />
                  </CircleIconButton>
                )}
                {hasAnyPhone && (
                  <TelesaleCallDialog
                    store={store}
                    trigger={(
                      <CircleIconButton label="Gọi điện">
                        <svg className="size-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
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
      <Card className="overflow-hidden rounded-lg transition duration-200" style={{ background: 'var(--surface)' }}>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <button
              type="button"
              className="flex min-w-0 flex-1 gap-4 text-left"
              onClick={handleOpenDetail}
            >
              <div className="flex size-12 shrink-0 items-center justify-center text-sky-300">
                {typeMeta.icon}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg md:text-xl leading-tight break-words" style={{ color: 'var(--foreground)' }}>
                  <HighlightedName name={store.name} term={searchTerm} />
                </h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  {distance !== null && distance !== undefined ? (
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(10,10,10,0.6)', color: 'var(--muted)' }}>
                      {formatDistance(distance)}
                    </span>
                  ) : !hasCoordinates ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-950/80 px-2 py-0.5 text-xs font-medium text-amber-200 shadow">
                      <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21c4.97-4.97 7-8.25 7-11a7 7 0 10-14 0c0 2.75 2.03 6.03 7 11z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
                      </svg>
                      Chưa có vị trí
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-1 text-base leading-snug text-gray-300 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <svg className="size-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.105 0 2-.893 2-1.995A2 2 0 0012 7a2 2 0 00-2 2.005C10 10.107 10.895 11 12 11z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1114 0z" />
                    </svg>
                    <p className="line-clamp-3 break-words flex-1">{addressText}</p>
                  </div>

                  {store.note && (
                    <div className="flex items-center gap-1.5">
                      <svg className="size-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                  <DirectionTurnIcon className="size-6" />
                </CircleIconButton>
              )}
              {hasAnyPhone && (
                <TelesaleCallDialog
                  store={store}
                  trigger={(
                    <CircleIconButton label="Gọi điện">
                      <svg className="size-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
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

export default memo(SearchStoreCard)
