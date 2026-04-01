import { useRouter } from 'next/router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'
import { hasStoreCoordinates } from '@/helper/storeSupplement'
import StoreDetailModal from '@/components/store-detail-modal'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'
import { DEFAULT_STORE_TYPE, STORE_TYPE_OPTIONS } from '@/lib/constants'

function getStoreTypeMeta(storeType) {
  const resolvedType = storeType || DEFAULT_STORE_TYPE
  const label = STORE_TYPE_OPTIONS.find((option) => option.value === resolvedType)?.label || 'Cửa hàng'

  if (resolvedType === 'quan_an') {
    return {
      label,
      icon: (
        <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22,16v-1c0-4.8364-3.4513-8.8801-8.0201-9.8016C13.9866,5.1322,14,5.0679,14,5c0-1.103-0.897-2-2-2s-2,0.897-2,2 c0,0.0679,0.0134,0.1322,0.0201,0.1984C5.4513,6.1199,2,10.1636,2,15v1c-0.5522,0-1,0.4478-1,1c0,2.2056,1.7944,4,4,4h14 c2.2056,0,4-1.7944,4-4C23,16.4478,22.5522,16,22,16z M4,15c0-4.4111,3.5889-8,8-8s8,3.5889,8,8l0.0015,1H4V15z M19,19H5 c-0.7388,0-1.3853-0.4028-1.7314-1H4h16h0.7314C20.3853,18.5972,19.7388,19,19,19z"></path>
        </svg>
      ),
    }
  }

  if (resolvedType === 'kho') {
    return {
      label,
      icon: (
        <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16,1.9,2,8.36V30H30V8.36ZM8,28V26H24v2Zm0-6H24v2H8Zm0-4H24v2H8Zm16-2H8V14H24Zm4,12H26V12H6V28H4V9.64L16,4.1,28,9.64Z"></path>
        </svg>
      ),
    }
  }

  if (resolvedType === 'karaoke') {
    return {
      label,
      icon: (
        <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 92 92" aria-hidden="true">
          <path d="M88.9 6.3c0-1.2-.5-2.4-1.5-3.1-.9-.8-2.1-1.1-3.3-.8L33.7 12.6c-1.9.4-3.2 2-3.2 3.9v45.9c-2.8-1.6-6.2-2.5-9.8-2.5-4.6 0-8.9 1.4-12.3 4.2C4.9 67.1 3 70.7 3 75c0 8.5 8 15 17.7 15 4.6 0 8.7-1.2 12-3.9 3.5-2.9 5.2-6.7 5.2-10.9v.1l.3-39.2 42.5-8.6v23.8C78 49.7 74.8 49 71.2 49c-4.6 0-8.9 1.3-12.3 4-3.5 2.9-5.5 6.6-5.5 10.9 0 8.5 8 15.1 17.7 15.1 9.3 0 17-6.1 17.7-14.1v-1.6l.1-57zm-61 73.6C26 81.5 23.5 82 20.7 82c-5.3 0-9.7-3-9.7-7 0-1.8.9-3.4 2.6-4.7 1.9-1.6 4.4-2.2 7.2-2.2 5.3 0 9.8 3.2 9.8 7.2-.1 1.7-1 3.2-2.7 4.6zm10.6-51v-9.1l42.4-8.7v9.1l-42.4 8.7zM71.2 71c-5.3 0-9.8-3.2-9.8-7.2 0-1.8.9-3.3 2.6-4.7 1.9-1.6 4.4-2.1 7.2-2.1 5 0 9.8 2.6 9.8 6.4v1.1c-1 3.8-4.8 6.5-9.8 6.5z"></path>
        </svg>
      ),
    }
  }

  return {
    label,
    icon: (
      <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 35 35" aria-hidden="true">
        <path d="M28.31,33.66H6.69a3.3,3.3,0,0,1-3.38-3.2V17.83a1.25,1.25,0,0,1,2.5,0V30.46a.81.81,0,0,0,.88.7H28.31a.81.81,0,0,0,.88-.7V17.83a1.25,1.25,0,0,1,2.5,0V30.46A3.3,3.3,0,0,1,28.31,33.66Z"></path>
        <path d="M20.79,19.3a4.27,4.27,0,0,1-2.29-.67l-1-.67a1.71,1.71,0,0,0-1.81,0l-1.1.66a4.23,4.23,0,0,1-4.78-.3,1.72,1.72,0,0,0-2-.11l-.42.26A4.19,4.19,0,0,1,2.33,18l-.74-.68A4.23,4.23,0,0,1,.25,14.21v-2.5A6.22,6.22,0,0,1,1,8.79L3.38,4.28A5.44,5.44,0,0,1,8.12,1.34H26.88a5.44,5.44,0,0,1,4.74,2.94L34,8.79a6.22,6.22,0,0,1,.72,2.92V14a4.22,4.22,0,0,1-1.68,3.36l-1.26.94a4.19,4.19,0,0,1-5.19-.11L26.34,18a1.72,1.72,0,0,0-2-.14l-1.4.85A4.15,4.15,0,0,1,20.79,19.3Zm-4.24-4.11a4.2,4.2,0,0,1,2.29.68l1,.66a1.71,1.71,0,0,0,1.81,0l1.41-.86a4.22,4.22,0,0,1,4.85.35l.28.23a1.68,1.68,0,0,0,2.1,0l1.26-.94h0A1.7,1.7,0,0,0,32.25,14V11.71A3.67,3.67,0,0,0,31.82,10L29.41,5.46a2.91,2.91,0,0,0-2.53-1.62H8.12A2.91,2.91,0,0,0,5.59,5.46L3.18,10a3.67,3.67,0,0,0-.43,1.74v2.5a1.75,1.75,0,0,0,.54,1.25l.74.68a1.7,1.7,0,0,0,2.06.19l.42-.26a4.2,4.2,0,0,1,4.83.27,1.72,1.72,0,0,0,1.94.12l1.09-.66A4.15,4.15,0,0,1,16.55,15.19Z"></path>
        <path d="M32.87 12.12H2.13a1.25 1.25 0 0 1 0-2.5H32.87a1.25 1.25 0 0 1 0 2.5zM21.5 33.08a1.25 1.25 0 0 1-1.25-1.25V25.75a1.1 1.1 0 0 0-1.1-1.1h-3.3a1.1 1.1 0 0 0-1.1 1.1v6.08a1.25 1.25 0 0 1-2.5 0V25.75a3.61 3.61 0 0 1 3.6-3.6h3.3a3.61 3.61 0 0 1 3.6 3.6v6.08A1.25 1.25 0 0 1 21.5 33.08z"></path>
      </svg>
    ),
  }
}

function CircleIconButton({ href, label, tone = 'sky', children }) {
  const toneClass = `border-gray-800 bg-gray-800 text-gray-400`
  const className = `flex h-10 w-10 items-center justify-center rounded-full border transition ${toneClass}`
  const isExternal = /^https?:/i.test(href)

  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      className={className}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noreferrer' : undefined}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </a>
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
  const addressText = formatAddressParts(store)
  const hasCoordinates = hasStoreCoordinates(store)
  const typeMeta = getStoreTypeMeta(store.store_type)
  const directionHref = hasCoordinates ? `https://www.google.com/maps?q=${store.latitude},${store.longitude}` : ''
  const phoneHref = store.phone ? `tel:${String(store.phone).replace(/[^0-9+]/g, '')}` : ''

  const handleCompactAction = (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (typeof onCompactAction === 'function') {
      onCompactAction(store, router)
    }
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
    const compactCard = (
      <Card className="overflow-hidden rounded-md border border-gray-800 bg-gray-950 transition duration-200 hover:shadow-md cursor-pointer">
        <CardContent className="p-0">
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-1 p-3">
            <div className="flex h-6 w-6 items-center justify-center text-sky-300">
              {typeMeta.icon}
            </div>

            <div className="min-w-0">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <OverflowMarquee
                    className="max-w-full"
                    textClassName="font-semibold text-gray-100 text-lg leading-snug"
                    contentKey={`${store.id}:${store.name}:${searchTerm || ''}`}
                  >
                    {renderHighlightedName(store.name, searchTerm)}
                  </OverflowMarquee>
                </div>
              </div>
            </div>

            <div className="row-span-3 flex shrink-0 flex-col justify-center gap-2">
              {hasCoordinates && (
                <CircleIconButton href={directionHref} label="Chỉ đường" tone="sky">
                  <svg className="h-4.5 w-4.5 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 128" id="location">
                    <g id="Layer_2">
                      <path d="M96 48c0 34.912-40.615 75.928-42.342 77.657a8.002 8.002 0 0 1-11.314 0C40.615 123.927 0 82.912 0 48a48 48 0 0 1 96 0zM48 72a24 24 0 1 0-24-24 23.999 23.999 0 0 0 24 24z"></path>
                    </g>
                  </svg>
                </CircleIconButton>
              )}
              {store.phone && (
                <CircleIconButton href={phoneHref} label="Gọi điện" tone="emerald">
                  <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.56 1 1 0 01-.24 1.01l-1.71 1.72z"></path>
                  </svg>
                </CircleIconButton>
              )}
            </div>

            {distance !== null && distance !== undefined ? (
              <span className="col-span-2 inline-flex items-center gap-1 leading-none text-base text-gray-400">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="leading-none">{formatDistance(distance)}</span>
              </span>
            ) : !hasCoordinates ? (
              <span className="col-span-2 inline-flex items-center gap-1 leading-none text-base text-amber-400">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21c4.97-4.97 7-8.25 7-11a7 7 0 10-14 0c0 2.75 2.03 6.03 7 11z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
                </svg>
                <span className="leading-none">Chưa có vị trí</span>
              </span>
            ) : null}

            <p className="col-span-2 text-base text-gray-400 line-clamp-2 leading-snug">{addressText}</p>
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
    )

    return <StoreDetailModal store={store} trigger={compactCard} />
  }

  const fullCard = (
    <Card className="overflow-hidden rounded-md border border-gray-800 bg-gray-950 transition duration-200 hover:shadow-lg cursor-pointer">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center text-sky-300">
            {typeMeta.icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <h3 className="font-semibold text-gray-100 text-lg md:text-xl leading-tight break-words">
                    {renderHighlightedName(store.name, searchTerm)}
                  </h3>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {hasCoordinates && (
                  <CircleIconButton href={directionHref} label="Chỉ đường" tone="sky">
                    <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 100 100" aria-hidden="true">
                      <path d="m86.3 11.2-74 30.7c-1.7.7-1.6 3.3.3 3.8l34.1 7.7 7.7 34.1c.4 1.9 3 2.1 3.7.3l30.8-74c.6-1.7-1-3.3-2.6-2.6zm-66.8 32 59.1-24.6-30.9 30.9-28.2-6.3zm37.3 37.3-6.4-28.2 30.9-30.9-24.5 59.1z"></path>
                    </svg>
                  </CircleIconButton>
                )}
                {store.phone && (
                  <CircleIconButton href={phoneHref} label="Gọi điện" tone="emerald">
                    <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.56 1 1 0 01-.24 1.01l-1.71 1.72z"></path>
                    </svg>
                  </CircleIconButton>
                )}
              </div>
            </div>

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
        </div>
      </CardContent>
    </Card>
  )

  return <StoreDetailModal store={store} trigger={fullCard} />
}
