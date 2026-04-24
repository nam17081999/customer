import { Virtuoso } from 'react-virtuoso'
import Link from 'next/link'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Msg } from '@/components/ui/msg'
import { STORE_TYPE_OPTIONS } from '@/lib/constants'
import SearchStoreCard from '@/components/search-store-card'
import {
  FILTER_FLAG_HAS_IMAGE,
  FILTER_FLAG_HAS_PHONE,
  FILTER_FLAG_NO_LOCATION,
  FILTER_FLAG_POTENTIAL,
} from '@/helper/homeSearch'
import { useHomeSearchController } from '@/helper/useHomeSearchController'

const DETAIL_FLAG_OPTIONS = [
  { value: FILTER_FLAG_HAS_PHONE, label: 'Có số điện thoại' },
  { value: FILTER_FLAG_HAS_IMAGE, label: 'Có ảnh' },
  { value: FILTER_FLAG_NO_LOCATION, label: 'Không có vị trí' },
  { value: FILTER_FLAG_POTENTIAL, label: 'Tiềm năng' },
]

export default function HomePage() {
  const {
    msgState,
    searchInputRef,
    virtuosoRef,
    searchTerm,
    setSearchTerm,
    selectedDistrict,
    setSelectedDistrict,
    selectedWard,
    setSelectedWard,
    selectedStoreTypes,
    setSelectedStoreTypes,
    selectedDetailFlags,
    setSelectedDetailFlags,
    showDetailedFilters,
    setShowDetailedFilters,
    activeFilterCount,
    hasSearchCriteria,
    wardOptions,
    districtOptions,
    toggleFilterValue,
    clearAllFilters,
    searchResults,
    showSkeleton,
  } = useHomeSearchController()

  return (
    <div className="h-[calc(100dvh-3.5rem)] overflow-hidden bg-black">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>
      <div className="mx-auto flex h-full max-w-screen-md flex-col gap-3 px-3 pt-4 sm:px-4 sm:pt-6">
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="VD: Tạp Hóa Minh Anh"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
              className="flex-1 text-base"
            />
            <Button
              type="button"
              variant={activeFilterCount > 0 || showDetailedFilters ? 'secondary' : 'outline'}
              onClick={() => setShowDetailedFilters((prev) => !prev)}
              className="h-11 shrink-0 gap-2 px-2.5 text-base sm:px-3"
              aria-expanded={showDetailedFilters}
              aria-controls="search-detail-filters"
              aria-label="Mở bộ lọc chi tiết"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M6 12h12m-9 7h6" />
              </svg>
              <span className="hidden sm:inline">Lọc</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-sky-500 px-1.5 py-0.5 text-sm font-semibold text-slate-950">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {showDetailedFilters && (
            <div
              id="search-detail-filters"
              className="overflow-x-hidden rounded-xl border border-gray-800 bg-gray-950 px-2.5 py-2.5 text-gray-100 sm:px-3 sm:py-3"
            >
              <div className="max-h-[68vh] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-300">Quận / Huyện</label>
                      <select
                        value={selectedDistrict}
                        onChange={(e) => {
                          setSelectedDistrict(e.target.value)
                          setSelectedWard('')
                        }}
                        className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100"
                      >
                        <option value="">Tất cả quận</option>
                        {districtOptions.map((district) => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-300">Xã / Phường</label>
                      <select
                        value={selectedWard}
                        onChange={(e) => setSelectedWard(e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100"
                      >
                        <option value="">{selectedDistrict ? 'Tất cả xã' : 'Tất cả xã/phường'}</option>
                        {wardOptions.map((ward) => (
                          <option key={ward} value={ward}>{ward}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-sm font-semibold text-gray-200">Loại cửa hàng</div>
                    <div className="grid grid-cols-2 gap-2">
                      {STORE_TYPE_OPTIONS.map((type) => {
                        const active = selectedStoreTypes.includes(type.value)
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => toggleFilterValue(setSelectedStoreTypes, type.value)}
                            className={`rounded-lg border px-2.5 py-2 text-sm font-medium transition ${
                              active
                                ? 'border-blue-500 bg-blue-500/15 text-blue-100'
                                : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            {type.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-sm font-semibold text-gray-200">Chi tiết dữ liệu</div>
                    <div className="grid grid-cols-2 gap-2">
                      {DETAIL_FLAG_OPTIONS.map((flag) => {
                        const active = selectedDetailFlags.includes(flag.value)
                        return (
                          <button
                            key={flag.value}
                            type="button"
                            onClick={() => toggleFilterValue(setSelectedDetailFlags, flag.value)}
                            className={`rounded-lg border px-2.5 py-2 text-sm font-medium transition ${
                              active
                                ? 'border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-100'
                                : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            {flag.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="sticky bottom-0 flex flex-col gap-2 border-t border-gray-800 bg-gray-950/95 pb-1 pt-2.5 backdrop-blur sm:static sm:flex-row sm:items-center sm:justify-between sm:bg-transparent sm:pb-0">
                    <p className="text-sm text-gray-400">
                      Đang áp dụng <span className="font-semibold text-gray-200">{activeFilterCount}</span> bộ lọc chi tiết
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-nowrap sm:items-center">
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="w-full whitespace-nowrap rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800 sm:w-auto"
                      >
                        Xóa lọc
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDetailedFilters(false)}
                        className="w-full whitespace-nowrap rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800 sm:w-auto"
                      >
                        Thu gọn
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showSkeleton ? (
            <div className="h-5 w-56 animate-pulse rounded bg-gray-800" aria-hidden="true" />
          ) : hasSearchCriteria ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="min-w-0 text-sm text-gray-400">
                Tìm thấy <span className="font-semibold text-gray-200">{searchResults.length}</span> cửa hàng
                {activeFilterCount > 0 && (
                  <span> với <span className="font-semibold text-gray-200">{activeFilterCount}</span> bộ lọc</span>
                )}
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-800 bg-red-900/20 px-2.5 py-1 text-xs font-medium text-red-400 transition hover:bg-red-900/40"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Xóa lọc
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Đang hiển thị <span className="font-semibold text-gray-200">{searchResults.length}</span> cửa hàng gần nhất
            </p>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {showSkeleton && (
            <div
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1"
              aria-label="Đang tải kết quả"
            >
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="overflow-hidden rounded-md border border-gray-800 bg-gray-950">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-[1fr_auto] gap-2 p-3">
                      <div className="min-w-0">
                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                          <div className="flex h-6 w-6 items-center justify-center">
                            <div className="h-4.5 w-4.5 animate-pulse rounded-sm bg-gray-800" />
                          </div>

                          <div className="min-w-0">
                            <div className="h-6 w-2/5 animate-pulse rounded bg-gray-700" />
                          </div>

                          <div className="col-span-2 mt-1 flex items-center gap-1">
                            <div className="h-4 w-4 animate-pulse rounded-full bg-gray-800" />
                            <div className="h-4 w-20 animate-pulse rounded bg-gray-800" />
                          </div>

                          <div className="col-span-2 mt-1 space-y-1.5 pr-1">
                            <div className="h-4 w-full animate-pulse rounded bg-gray-800" />
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col justify-center gap-2">
                        <div className="h-10 w-10 animate-pulse rounded-full border border-gray-800 bg-gray-800" />
                        <div className="h-10 w-10 animate-pulse rounded-full border border-gray-800 bg-gray-800" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!showSkeleton && searchResults.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="mb-1 font-medium text-gray-300">Không tìm thấy cửa hàng</p>
              <p className="mb-4 text-sm text-gray-500">Thử tìm với từ khác hoặc bớt bộ lọc</p>
              <Button asChild>
                <Link href="/store/create">+ Tạo cửa hàng mới</Link>
              </Button>
            </div>
          )}

          {!showSkeleton && searchResults.length > 0 && (
            <div className="min-h-0 flex-1">
              <Virtuoso
                ref={virtuosoRef}
                style={{ height: '100%' }}
                data={searchResults}
                computeItemKey={(index, item) => String(item.id)}
                overscan={300}
                itemContent={(index, store) => (
                  <div className="mb-3" key={store.id}>
                    <SearchStoreCard
                      store={store}
                      distance={store.distance}
                      searchTerm={searchTerm}
                      compact
                    />
                  </div>
                )}
                components={{
                  Footer: () => (
                    <div className="pb-4 pt-2 text-center text-sm text-gray-500">
                      Hết kết quả
                    </div>
                  )
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
