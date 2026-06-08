import { useState, useEffect, useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Msg } from '@/components/ui/msg'
import { STORE_TYPE_OPTIONS } from '@/lib/constants'
import SearchStoreCard from '@/components/search-store-card'
import {
  FILTER_FLAG_HAS_PHONE,
  FILTER_FLAG_NO_LOCATION,
  FILTER_FLAG_POTENTIAL,
  SORT_OPTIONS,
  ACTIVE_STATUS_OPTIONS,
} from '@/helper/homeSearch'
import { useHomeSearchController } from '@/helper/useHomeSearchController'

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
  sortBy,
  setSortBy,
  activeStatus,
  setActiveStatus,
  desktop = false,
}) {
  const buttonBase = desktop
    ? 'rounded-md border px-3 py-2 text-left text-base font-medium transition'
    : 'rounded-lg border px-2.5 py-2 text-sm font-medium transition'

  // Collapsible sections on desktop
  const [sectionOpen, setSectionOpen] = useState({
    location: true,
    type: true,
    status: true,
    flags: true,
    sort: true,
  })

  const toggleSection = (key) => {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const SectionToggle = ({ sectionKey, label, count }) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionKey)}
      className="flex w-full items-center justify-between text-sm font-semibold text-gray-200"
    >
      <span>{label}{count > 0 ? ` (${count})` : ''}</span>
      <svg className={`h-4 w-4 text-gray-500 transition ${sectionOpen[sectionKey] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )

  return (
    <div className={desktop ? 'flex h-full min-h-0 flex-col' : 'space-y-3'}>
      {desktop && (
        <div className="border-b border-gray-800 px-4 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-300">Bộ lọc</p>
          <h2 className="mt-1 text-xl font-bold text-gray-100">Lọc cửa hàng</h2>
          <p className="mt-1 text-sm text-gray-400">
            {activeFilterCount > 0 ? `${activeFilterCount} bộ lọc đang áp dụng` : 'Chưa áp dụng bộ lọc'}
          </p>
        </div>
      )}

      <div className={desktop ? 'min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4' : 'space-y-3'}>
        {/* ── Desktop: Sắp xếp ── */}
        {desktop && (
          <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <SectionToggle sectionKey="sort" label="Sắp xếp" count={0} />
            {sectionOpen.sort && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSortBy(opt.value)}
                    className={`rounded-md border px-3 py-2 text-left text-sm font-medium transition ${
                      sortBy === opt.value
                        ? 'border-amber-500 bg-amber-500/15 text-amber-100'
                        : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Desktop: Trạng thái duyệt ── */}
        {desktop && (
          <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <SectionToggle sectionKey="status" label="Trạng thái" count={activeStatus !== 'all' ? 1 : 0} />
            {sectionOpen.status && (
              <div className="flex flex-wrap gap-2 pt-1">
                {ACTIVE_STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setActiveStatus(opt.value)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                      activeStatus === opt.value
                        ? opt.value === 'all'
                          ? 'border-gray-600 bg-gray-800 text-gray-100'
                          : opt.value === 'active'
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-100'
                            : 'border-orange-500 bg-orange-500/15 text-orange-100'
                        : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Địa điểm (district + ward) — desktop has collapsible section ── */}
        {desktop ? (
          <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <SectionToggle sectionKey="location" label="Địa điểm" count={(selectedDistrict ? 1 : 0) + (selectedWard ? 1 : 0)} />
            {sectionOpen.location && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">Quận / Huyện</label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => {
                      setSelectedDistrict(e.target.value)
                      setSelectedWard('')
                    }}
                    className="h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
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
                    className="h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
                  >
                    <option value="">{selectedDistrict ? 'Tất cả xã' : 'Tất cả xã/phường'}</option>
                    {wardOptions.map((ward) => (
                      <option key={ward} value={ward}>{ward}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Quận / Huyện</label>
              <select
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value)
                  setSelectedWard('')
                }}
                className="h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
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
                className="h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
              >
                <option value="">{selectedDistrict ? 'Tất cả xã' : 'Tất cả xã/phường'}</option>
                {wardOptions.map((ward) => (
                  <option key={ward} value={ward}>{ward}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── Loại cửa hàng ── */}
        {desktop ? (
          <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <SectionToggle sectionKey="type" label="Loại cửa hàng" count={selectedStoreTypes.length} />
            {sectionOpen.type && (
              <div className="flex flex-wrap gap-3 pt-1">
                {STORE_TYPE_OPTIONS.map((type) => {
                  const active = selectedStoreTypes.includes(type.value)
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => toggleFilterValue(setSelectedStoreTypes, type.value)}
                      className={`${buttonBase} ${
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
            )}
          </div>
        ) : (
          <>
            <div>
              <div className="mb-2 text-sm font-semibold text-gray-200">Loại cửa hàng</div>
              <div className="grid grid-cols-2 gap-3">
                {STORE_TYPE_OPTIONS.map((type) => {
                  const active = selectedStoreTypes.includes(type.value)
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => toggleFilterValue(setSelectedStoreTypes, type.value)}
                      className={`${buttonBase} ${
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
          </>
        )}

        {/* ── Chi tiết dữ liệu ── */}
        {desktop ? (
          <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <SectionToggle sectionKey="flags" label="Chi tiết dữ liệu" count={selectedDetailFlags.length} />
            {sectionOpen.flags && (
              <div className="flex flex-wrap gap-3 pt-1">
                {DETAIL_FLAG_OPTIONS.map((flag) => {
                  const active = selectedDetailFlags.includes(flag.value)
                  return (
                    <button
                      key={flag.value}
                      type="button"
                      onClick={() => toggleFilterValue(setSelectedDetailFlags, flag.value)}
                      className={`${buttonBase} ${
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
            )}
          </div>
        ) : (
          <div>
            <div className="mb-2 text-sm font-semibold text-gray-200">Chi tiết dữ liệu</div>
            <div className="grid grid-cols-2 gap-3">
              {DETAIL_FLAG_OPTIONS.map((flag) => {
                const active = selectedDetailFlags.includes(flag.value)
                return (
                  <button
                    key={flag.value}
                    type="button"
                    onClick={() => toggleFilterValue(setSelectedDetailFlags, flag.value)}
                    className={`${buttonBase} ${
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
        )}
      </div>

      <div className={desktop ? 'border-t border-gray-800 px-4 py-4' : 'sticky bottom-0 flex flex-col gap-2 border-t border-gray-800 bg-gray-950/95 pb-1 pt-2.5 backdrop-blur sm:static sm:flex-row sm:items-center sm:justify-between sm:bg-transparent sm:pb-0'}>
        {!desktop && (
          <p className="text-sm text-gray-400">
            Đang áp dụng <span className="font-semibold text-gray-200">{activeFilterCount}</span> bộ lọc chi tiết
          </p>
        )}
        <div className={desktop ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 gap-2 sm:flex sm:flex-nowrap sm:items-center'}>
          <button
            type="button"
            onClick={clearAllFilters}
            className="w-full whitespace-nowrap rounded-md border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800"
          >
            Xóa lọc
          </button>
          {!desktop && (
            <button
              type="button"
              onClick={onCollapse}
              className="w-full whitespace-nowrap rounded-md border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800"
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
      {!desktop && showCreateStoreCta && (
        <Button type="button" variant="outline" className="h-9 shrink-0 px-3 text-sm" onClick={handleCreateStoreClick}>
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
    const SkeletonCard = () => (
      <Card className="overflow-hidden rounded-lg" style={{ background: 'var(--surface)' }}>
        <CardContent className="p-0">
          <div className="grid grid-cols-[1fr_auto] gap-2 p-3">
            <div className="min-w-0">
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                <div className="size-6 animate-pulse rounded bg-gray-800" />
                <div className="min-w-0">
                  <div className="h-6 w-3/5 animate-pulse rounded bg-gray-700" />
                </div>
                <div className="col-span-2 mt-1 space-y-1">
                  <div className="h-6 w-16 animate-pulse rounded-md bg-gray-700" />
                  <div className="h-5 w-full animate-pulse rounded bg-gray-800" />
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-2">
              <div className="size-10 animate-pulse rounded-full bg-gray-800" />
              <div className="size-10 animate-pulse rounded-full bg-gray-800" />
            </div>
          </div>
        </CardContent>
      </Card>
    )

    if (desktop) {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1" aria-label="Đang tải kết quả">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="pb-2.5"><SkeletonCard /></div>
          ))}
        </div>
      )
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1" aria-label="Đang tải kết quả">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="pb-3"><SkeletonCard /></div>
        ))}
      </div>
    )
  }

  if (searchResults.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
          <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="mb-1 font-medium text-gray-300">Không tìm thấy cửa hàng</p>
        <p className="mb-4 text-sm text-gray-500">Thử tìm với từ khác hoặc bớt bộ lọc</p>
        {showCreateStoreCta && (
          <Button type="button" onClick={handleCreateStoreClick}>
            + Tạo cửa hàng mới
          </Button>
        )}
      </div>
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
    sortBy,
    setSortBy,
    activeStatus,
    setActiveStatus,
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
    sortBy,
    setSortBy,
    activeStatus,
    setActiveStatus,
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
    <div className="bg-black overflow-hidden sm:h-[calc(100dvh-3rem)]" style={{ height: 'calc(100svh - 3.5rem)', color: 'var(--foreground)' }}>
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>

      <div className="mx-auto flex h-full max-w-screen-md flex-col gap-4 px-4 pt-5 sm:hidden">
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
              className="h-11 shrink-0 gap-2 px-2.5 text-base"
              aria-expanded={showDetailedFilters}
              aria-controls="search-detail-filters"
              aria-label="Mở bộ lọc chi tiết"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M6 12h12m-9 7h6" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-sky-500 px-1.5 py-0.5 text-sm font-semibold text-gray-950">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {showDetailedFilters && (
            <div id="search-detail-filters" className="overflow-x-hidden rounded-xl px-3 py-3" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'var(--surface)', color: 'var(--foreground)' }}>
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

      <div className="hidden h-full w-full px-4 py-4 sm:block 2xl:px-6">
        <div className="mx-auto grid h-full w-full max-w-[1900px] grid-cols-[330px_minmax(0,1fr)] gap-4">
          <aside className="min-h-0 overflow-hidden rounded-lg border border-gray-800 bg-gray-950/88 shadow-2xl shadow-black/20">
            <FilterControls {...filterProps} desktop />
          </aside>

          <main className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-950/70 shadow-2xl shadow-black/20">
            <div className="shrink-0 border-b border-gray-800 bg-gray-950/85 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Tìm kiếm cửa hàng</p>
                  <h1 className="mt-1 text-2xl font-bold text-gray-100">Danh sách cửa hàng</h1>
                </div>
                <div className="grid grid-cols-2 gap-2 text-right">
                  <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2">
                    <p className="text-sm text-gray-400">Kết quả</p>
                    <p className="text-xl font-bold text-gray-100">{showSkeleton ? '...' : searchResults.length}</p>
                  </div>
                  <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2">
                    <p className="text-sm text-gray-400">Bộ lọc</p>
                    <p className="text-xl font-bold text-sky-200">{activeFilterCount}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Tìm theo tên cửa hàng, ví dụ: Tạp Hóa Minh Anh"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoComplete="off"
                  className="h-12 rounded-md border-gray-700 bg-gray-900 text-base"
                />
                {showCreateStoreCta && (
                  <Button type="button" onClick={handleCreateStoreClick} className="h-12">
                    + Tạo cửa hàng
                  </Button>
                )}
              </div>

              <div className="mt-3">
                <ResultsMeta {...metaProps} desktop />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4">
              <ResultsList {...listProps} desktop />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
