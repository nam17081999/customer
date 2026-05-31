import { Virtuoso } from 'react-virtuoso'
import { useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Msg } from '@/components/ui/msg'
import { STORE_TYPE_OPTIONS } from '@/lib/constants'
import SearchStoreCard from '@/components/search-store-card'
import {
  FILTER_FLAG_HAS_PHONE,
  FILTER_FLAG_NO_LOCATION,
  FILTER_FLAG_POTENTIAL,
} from '@/helper/homeSearch'
import { useHomeSearchController } from '@/helper/useHomeSearchController'
import { FilterChip, Badge, EmptyState, PageHeader, Section } from '@/components/ui/v2'

const DETAIL_FLAG_OPTIONS = [
  { value: FILTER_FLAG_HAS_PHONE, label: 'Có số điện thoại' },
  { value: FILTER_FLAG_NO_LOCATION, label: 'Không có vị trí' },
  { value: FILTER_FLAG_POTENTIAL, label: 'Tiềm năng' },
]

function FilterControls({
  selectedDistrict,
  setSelectedDistrict,
  selectedWard,
  setSelectedWard,
  selectedStoreTypes,
  setSelectedStoreTypes,
  selectedDetailFlags,
  setSelectedDetailFlags,
  activeFilterCount,
  wardOptions,
  districtOptions,
  toggleFilterValue,
  clearAllFilters,
  onCollapse,
  desktop = false,
}) {
  return (
    <div className={desktop ? 'flex h-full min-h-0 flex-col' : 'space-y-3'}>
      {desktop && (
        <div className="border-b border-gray-800 px-4 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">Bộ lọc</p>
          <h2 className="mt-1 text-xl font-bold text-gray-100">Lọc cửa hàng</h2>
          <p className="mt-1 text-sm text-gray-400">
            {activeFilterCount > 0 ? `${activeFilterCount} bộ lọc đang áp dụng` : 'Chưa áp dụng bộ lọc'}
          </p>
        </div>
      )}

      <div className={desktop ? 'min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4' : 'space-y-3'}>
        <div className={desktop ? 'space-y-3' : 'grid grid-cols-2 gap-2'}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Quận / Huyện</label>
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value)
                setSelectedWard('')
              }}
              className="h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
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
              className="h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
            >
              <option value="">{selectedDistrict ? 'Tất cả xã' : 'Tất cả xã/phường'}</option>
              {wardOptions.map((ward) => (
                <option key={ward} value={ward}>{ward}</option>
              ))}
            </select>
          </div>
        </div>

        <Section title="Loại cửa hàng">
          <div className={desktop ? 'flex flex-wrap gap-3' : 'grid grid-cols-2 gap-3'}>
            {STORE_TYPE_OPTIONS.map((type) => (
              <FilterChip
                key={type.value}
                active={selectedStoreTypes.includes(type.value)}
                onClick={() => toggleFilterValue(setSelectedStoreTypes, type.value)}
              >
                {type.label}
              </FilterChip>
            ))}
          </div>
        </Section>

        <Section title="Chi tiết dữ liệu">
          <div className={desktop ? 'flex flex-wrap gap-3' : 'grid grid-cols-2 gap-3'}>
            {DETAIL_FLAG_OPTIONS.map((flag) => (
              <FilterChip
                key={flag.value}
                active={selectedDetailFlags.includes(flag.value)}
                onClick={() => toggleFilterValue(setSelectedDetailFlags, flag.value)}
                className={selectedDetailFlags.includes(flag.value) ? 'border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-100' : ''}
              >
                {flag.label}
              </FilterChip>
            ))}
          </div>
        </Section>
      </div>

      <div className={desktop ? 'border-t border-gray-800 px-4 py-4' : 'sticky bottom-0 flex flex-col gap-2 border-t border-gray-800 bg-gray-950/95 pb-1 pt-2.5 backdrop-blur sm:static sm:flex-row sm:items-center sm:justify-between sm:bg-transparent sm:pb-0'}>
        {!desktop && (
          <p className="text-sm text-gray-400">
            Đang áp dụng <span className="font-semibold text-gray-200">{activeFilterCount}</span> bộ lọc
          </p>
        )}
        <div className={desktop ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 gap-2 sm:flex sm:flex-nowrap sm:items-center'}>
          <button
            type="button"
            onClick={clearAllFilters}
            className="w-full whitespace-nowrap rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800"
          >
            Xóa lọc
          </button>
          {!desktop && (
            <button
              type="button"
              onClick={onCollapse}
              className="w-full whitespace-nowrap rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800"
            >
              Thu gọn
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultsMeta({
  showSkeleton,
  hasSearchCriteria,
  searchResults,
  activeFilterCount,
  showCreateStoreCta,
  handleCreateStoreClick,
  clearAllFilters,
  desktop = false,
}) {
  if (showSkeleton) {
    return <div className="h-5 w-56 animate-pulse rounded bg-gray-800" aria-hidden="true" />
  }

  if (!hasSearchCriteria) {
    return (
      <p className={desktop ? 'text-base text-gray-400' : 'text-sm text-gray-400'}>
        Đang hiển thị <span className="font-semibold text-gray-200">{searchResults.length}</span> cửa hàng gần nhất
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <p className={desktop ? 'min-w-0 text-base text-gray-400' : 'min-w-0 text-sm text-gray-400'}>
        Tìm thấy <span className="font-semibold text-gray-200">{searchResults.length}</span> cửa hàng
        {activeFilterCount > 0 && (
          <span> với <span className="font-semibold text-gray-200">{activeFilterCount}</span> bộ lọc</span>
        )}
      </p>
      <button
        type="button"
        onClick={clearAllFilters}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-800 bg-red-900/20 px-2.5 py-1 text-sm font-medium text-red-400 transition hover:bg-red-900/40"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        Xóa lọc
      </button>
      {showCreateStoreCta && (
        <Button type="button" variant="outline" className="h-9 shrink-0 px-3 text-sm relative z-[99999]" onClick={handleCreateStoreClick}>
          + Tạo cửa hàng
        </Button>
      )}
    </div>
  )
}

function ResultsList({
  showSkeleton,
  searchResults,
  virtuosoRef,
  handleListAtTopChange,
  searchTerm,
  showCreateStoreCta,
  handleCreateStoreClick,
  desktop = false,
}) {
  if (showSkeleton) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1" aria-label="Đang tải kết quả">
        {[...Array(desktop ? 8 : 10)].map((_, i) => (
          <div key={i} className="min-h-[135px] rounded-xl border border-gray-800 bg-gray-950 p-3">
            <div className="h-6 w-2/5 animate-pulse rounded bg-gray-700" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-gray-800" />
            <div className="mt-3 h-4 w-full animate-pulse rounded bg-gray-800" />
            <div className="mt-4 flex gap-2">
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-800" />
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (searchResults.length === 0) {
    return (
      <EmptyState
        title="Không tìm thấy cửa hàng"
        description="Thử tìm với từ khác hoặc bớt bộ lọc"
        action={showCreateStoreCta && (
          <Button type="button" onClick={handleCreateStoreClick}>
            + Tạo cửa hàng mới
          </Button>
        )}
      />
    )
  }

  return (
    <div className="min-h-0 flex-1">
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: '100%' }}
        data={searchResults}
        atTopStateChange={handleListAtTopChange}
        fixedItemHeight={desktop ? 118 : 124}
        computeItemKey={(index, item) => String(item.id)}
        overscan={desktop ? 260 : 180}
        itemContent={(index, store) => (
          <div className={desktop ? 'pb-2.5' : 'pb-3'} key={store.id}>
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
          ),
        }}
      />
    </div>
  )
}

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
    handleListAtTopChange,
    searchResults,
    showCreateStoreCta,
    handleCreateStoreClick,
    showSkeleton,
  } = useHomeSearchController()

  const filterProps = {
    selectedDistrict,
    setSelectedDistrict,
    selectedWard,
    setSelectedWard,
    selectedStoreTypes,
    setSelectedStoreTypes,
    selectedDetailFlags,
    setSelectedDetailFlags,
    activeFilterCount,
    wardOptions,
    districtOptions,
    toggleFilterValue,
    clearAllFilters,
    onCollapse: () => setShowDetailedFilters(false),
  }

  const metaProps = {
    showSkeleton,
    hasSearchCriteria,
    searchResults,
    activeFilterCount,
    showCreateStoreCta,
    handleCreateStoreClick,
    clearAllFilters,
  }

  const listProps = {
    showSkeleton,
    searchResults,
    virtuosoRef,
    handleListAtTopChange,
    searchTerm,
    showCreateStoreCta,
    handleCreateStoreClick,
  }

  return (
    <div className="h-[calc(100svh-3.5rem)] overflow-hidden sm:h-[calc(100dvh-3rem)]">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>

      {typeof window !== 'undefined' ? (
        (() => {
          const isMobile = window.matchMedia('(max-width: 639px)').matches
          return isMobile ? (
            <div className="mx-auto flex h-full max-w-screen-md flex-col gap-3 px-3 pt-4">
              <PageHeader
                title="Tìm cửa hàng"
                subtitle="Tra cứu nhanh, lọc chi tiết và mở bản đồ trong một luồng ngắn gọn."
              />
              <div className="flex shrink-0 flex-col gap-2 rounded-3xl border border-slate-800/80 bg-slate-950/75 p-3 shadow-xl shadow-black/10">
                <div className="flex items-center gap-2">
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Tìm cửa hàng, ví dụ: Tạp Hóa Minh Anh"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoComplete="off"
                    className="flex-1 text-base"
                  />
                    <Button
                      type="button"
                      variant={activeFilterCount > 0 || showDetailedFilters ? 'secondary' : 'outline'}
                      onClick={() => setShowDetailedFilters((prev) => !prev)}
                    className="h-11 shrink-0 gap-2 px-2.5 text-base relative z-[99999]"
                    aria-expanded={showDetailedFilters}
                    aria-controls="search-detail-filters"
                    aria-label="Mở bộ lọc chi tiết"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M6 12h12m-9 7h6" />
                    </svg>
                    {activeFilterCount > 0 && (
                      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-blue-500 px-1.5 py-0.5 text-sm font-semibold text-gray-950">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </div>

                {showDetailedFilters && (
                  <div id="search-detail-filters" className="overflow-x-hidden rounded-3xl border border-slate-800/80 bg-slate-950/85 px-2.5 py-2.5 text-gray-100">
                    <div className="max-h-[68vh] overflow-y-auto pr-1">
                      <FilterControls {...filterProps} />
                    </div>
                  </div>
                )}

                <ResultsMeta {...metaProps} />
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                <ResultsList {...listProps} />
              </div>
            </div>
          ) : (
            <div className="hidden h-full w-full px-4 py-4 sm:block 2xl:px-6">
              <div className="mx-auto grid h-full w-full max-w-[1900px] grid-cols-[330px_minmax(0,1fr)] gap-4">
                <aside className="min-h-0 overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/75 shadow-2xl shadow-black/20">
                  <FilterControls {...filterProps} desktop />
                </aside>

                <main className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/70 shadow-2xl shadow-black/20">
                  <div className="shrink-0 border-b border-slate-800/80 bg-slate-950/85 px-5 py-4">
                    <PageHeader
                      title="Danh sách cửa hàng"
                      subtitle={`${showSkeleton ? '...' : searchResults.length} kết quả`}
                      actions={
                        <button
                          type="button"
                          onClick={() => setShowDetailedFilters((prev) => !prev)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-slate-800"
                          aria-expanded={showDetailedFilters}
                        >
                          Mở bộ lọc chi tiết
                        </button>
                      }
                    />
                    <div className="mt-4">
                      <Input
                        ref={searchInputRef}
                        type="text"
                        placeholder="VD: Tạp Hóa Minh Anh"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoComplete="off"
                        className="h-12 rounded-xl border-slate-700 bg-slate-900 text-base"
                      />
                    </div>
                    <div className="mt-3">
                      <ResultsMeta {...metaProps} desktop />
                    </div>
                    {showDetailedFilters && (
                      <div id="search-detail-filters" className="mt-4 overflow-x-hidden rounded-3xl border border-slate-800/80 bg-slate-950/85 px-2.5 py-2.5 text-gray-100">
                        <div className="max-h-[68vh] overflow-y-auto pr-1">
                          <FilterControls {...filterProps} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4">
                    <ResultsList {...listProps} desktop />
                  </div>
                </main>
              </div>
            </div>
          )
        })()
      ) : (
        <div className="hidden h-full w-full px-4 py-4 sm:block 2xl:px-6">
          <div className="mx-auto grid h-full w-full max-w-[1900px] grid-cols-[330px_minmax(0,1fr)] gap-4">
            <aside className="min-h-0 overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/75 shadow-2xl shadow-black/20">
              <FilterControls {...filterProps} desktop />
            </aside>

            <main className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/70 shadow-2xl shadow-black/20">
              <div className="shrink-0 border-b border-slate-800/80 bg-slate-950/85 px-5 py-4">
                <PageHeader title="Danh sách cửa hàng" />
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4">
                <ResultsList {...listProps} desktop />
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  )
}
