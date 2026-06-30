import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Msg } from '@/components/ui/msg'
import { EmptyState } from '@/components/ui/empty-state'
import StoreCard from '@/components/store/store-card'
import StoreDetailModalSimple from '@/components/store/store-detail-modal-simple'
import StoreDetailSheet from '@/components/store/store-detail-sheet'
import { STORE_TYPE_OPTIONS, DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'
import { useHomeSearchController } from '@/helper/useHomeSearchController'

const DISTRICTS = Object.keys(DISTRICT_WARD_SUGGESTIONS).sort((a, b) => a.localeCompare(b, 'vi'))
const ALL_WARDS = Array.from(new Set(Object.values(DISTRICT_WARD_SUGGESTIONS).flat())).sort((a, b) => a.localeCompare(b, 'vi'))
const BATCH_SIZE = 20

function SkeletonGrid() {
  return (
    <div className="store-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-4 animate-pulse">
          <div className="flex gap-3 items-start mb-3">
            <div className="w-9 h-9 rounded bg-[var(--surface2)] shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-[var(--surface2)]" />
              <div className="h-3 w-1/3 rounded bg-[var(--surface2)]" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-[var(--surface2)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--surface2)]" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HomePage() {
  const {
    msgState,
    searchInputRef,
    searchTerm, setSearchTerm,
    selectedDistrict, setSelectedDistrict,
    selectedWard, setSelectedWard,
    selectedStoreTypes, setSelectedStoreTypes,
    selectedDetailFlags, setSelectedDetailFlags,
    sortBy, setSortBy,
    activeStatus, setActiveStatus,
    activeFilterCount,
    hasSearchCriteria,
    clearAllFilters,
    searchResults,
    showCreateStoreCta, handleCreateStoreClick,
    showSkeleton, hasError,
    retryLoadStores,
  } = useHomeSearchController()

  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [selectedStore, setSelectedStore] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [displayCount, setDisplayCount] = useState(BATCH_SIZE)
  const sentinelRef = useRef(null)
  const scrollRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)

  /* ── Infinite scroll: load more when sentinel enters scroll container ── */
  useEffect(() => {
    const el = sentinelRef.current
    const root = scrollRef.current
    if (!el || !root || searchResults.length <= displayCount) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setDisplayCount((p) => p + BATCH_SIZE) },
      { root, rootMargin: '200px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [searchResults.length, displayCount])

  /* ── Reset display count when filters/search change ── */
  useEffect(() => {
    setDisplayCount(BATCH_SIZE)
  }, [searchTerm, selectedDistrict, selectedWard, selectedStoreTypes, selectedDetailFlags, sortBy, activeStatus])

  /* ── Mobile detection ── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 600)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const visibleStores = useMemo(
    () => searchResults.slice(0, displayCount),
    [searchResults, displayCount]
  )
  const hasMore = displayCount < searchResults.length

  const handleOpenDetail = useCallback((store) => {
    setSelectedStore(store)
    setDetailOpen(true)
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchTerm('')
    searchInputRef.current?.focus()
  }, [setSearchTerm, searchInputRef])

  const handleResetFilters = useCallback(() => {
    clearAllFilters()
  }, [clearAllFilters])

  const toggleFilter = useCallback(() => {
    if (window.innerWidth <= 600) {
      setShowFilterSheet((prev) => !prev)
    } else {
      setShowFilterPanel((prev) => !prev)
    }
  }, [])

  const closeFilterSheet = useCallback(() => {
    setShowFilterSheet(false)
  }, [])

  const wardOptions = useMemo(() => {
    if (selectedDistrict) {
      return (DISTRICT_WARD_SUGGESTIONS[selectedDistrict] || []).slice().sort((a, b) => a.localeCompare(b, 'vi'))
    }
    return ALL_WARDS
  }, [selectedDistrict])

  const selectedStoreType = selectedStoreTypes.length === 1 ? selectedStoreTypes[0] : ''

  const handleStoreTypeChange = useCallback((value) => {
    setSelectedStoreTypes(value ? [value] : [])
  }, [setSelectedStoreTypes])

  const handleSortChange = useCallback((value) => {
    setSortBy(value || 'distance')
  }, [setSortBy])

  const handleStatusChange = useCallback((value) => {
    setActiveStatus(value || 'all')
  }, [setActiveStatus])

  const filterPanel = showFilterPanel && (
    <div className="filter-panel open">
      <div className="filter-inner">
        <div className="filter-group">
          <label>Quận/Huyện</label>
          <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedWard('') }}>
            <option value="">Tất cả</option>
            {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Xã/Phường</label>
          <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)}>
            <option value="">{selectedDistrict ? 'Tất cả xã' : 'Tất cả xã/phường'}</option>
            {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Trạng thái</label>
          <select value={activeStatus === 'all' ? '' : activeStatus} onChange={(e) => handleStatusChange(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="active">Đã XT</option>
            <option value="inactive">Chưa XT</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Loại CH</label>
          <select value={selectedStoreType} onChange={(e) => handleStoreTypeChange(e.target.value)}>
            <option value="">Tất cả</option>
            {STORE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Sắp xếp</label>
          <select value={sortBy === 'distance' ? '' : sortBy === 'newest' ? 'date' : sortBy} onChange={(e) => handleSortChange(e.target.value)}>
            <option value="">Mặc định</option>
            <option value="name">Tên A-Z</option>
            <option value="date">Mới nhất</option>
          </select>
        </div>
        <div className="filter-actions">
          <button className="btn btn-outline btn-sm" onClick={handleResetFilters}>
            <X className="size-3" />
            Xóa lọc
          </button>
        </div>
      </div>
    </div>
  )

  const filterSheet = showFilterSheet && (
    <>
      <div className="filter-backdrop open" onClick={closeFilterSheet} />
      <div className="filter-sheet open">
        <div className="sheet-handle" />
        <div className="sheet-title">Bộ lọc</div>
        <div className="sheet-group">
          <label>Quận/Huyện</label>
          <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedWard('') }}>
            <option value="">Tất cả</option>
            {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="sheet-group">
          <label>Xã/Phường</label>
          <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)}>
            <option value="">Tất cả</option>
            {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div className="sheet-group">
          <label>Trạng thái</label>
          <select value={activeStatus === 'all' ? '' : activeStatus} onChange={(e) => handleStatusChange(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="active">Đã XT</option>
            <option value="inactive">Chưa XT</option>
          </select>
        </div>
        <div className="sheet-group">
          <label>Loại CH</label>
          <select value={selectedStoreType} onChange={(e) => handleStoreTypeChange(e.target.value)}>
            <option value="">Tất cả</option>
            {STORE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="sheet-group">
          <label>Sắp xếp</label>
          <select value={sortBy === 'distance' ? '' : sortBy === 'newest' ? 'date' : sortBy} onChange={(e) => handleSortChange(e.target.value)}>
            <option value="">Mặc định</option>
            <option value="name">Tên A-Z</option>
            <option value="date">Mới nhất</option>
          </select>
        </div>
        <button className="apply-btn" onClick={closeFilterSheet}>Áp dụng</button>
      </div>
    </>
  )

  const searchClearVisible = searchTerm.length > 0

  const hasActiveFilters = activeFilterCount > 0

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <Search className="size-[14px] shrink-0 text-[var(--muted)]" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Tìm tên CH hoặc SĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
          />
          <button
            className={`search-clear ${searchClearVisible ? 'visible' : ''}`}
            onClick={handleClearSearch}
            aria-label="Xóa tìm kiếm"
          >
            <X className="size-3" />
          </button>
        </div>

        <button
          type="button"
          className="filter-toggle"
          onClick={toggleFilter}
          aria-expanded={showFilterPanel || showFilterSheet}
          aria-label="Bộ lọc"
        >
          <SlidersHorizontal className="size-[14px]" />
          <span>Bộ lọc</span>
          {hasActiveFilters && <span className="filter-badge show">{activeFilterCount}</span>}
        </button>

        {hasActiveFilters && (
          <button
            className="filter-clear-mobile show"
            onClick={handleResetFilters}
            aria-label="Xóa lọc"
          >
            <X className="size-3" />
            Xóa lọc
          </button>
        )}

        {showCreateStoreCta && (
          <button type="button" onClick={handleCreateStoreClick} className="btn btn-primary btn-sm sm:inline-flex hidden">
            + Thêm CH
          </button>
        )}
      </div>

      {/* Filter Panel (desktop) */}
      {filterPanel}

      {/* Filter Sheet (mobile) */}
      {filterSheet}

      {/* Results info */}
      <div className="flex items-center gap-2 flex-wrap mb-3 shrink-0">
        {!showSkeleton && searchResults.length > 0 && (
          <p className="text-[13px] text-[var(--muted)]">
            {hasSearchCriteria ? (
              <>Tìm thấy <span className="font-semibold text-[var(--fg)]">{searchResults.length}</span> cửa hàng</>
            ) : (
              <>Đang hiển thị <span className="font-semibold text-[var(--fg)]">{searchResults.length}</span> cửa hàng</>
            )}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollRef} style={{ overscrollBehavior: 'contain' }}>
        {hasError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--red)]/10 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[var(--red)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[14px] font-medium text-[var(--red)] mb-3">Không thể tải dữ liệu. Vui lòng thử lại.</p>
            <button type="button" onClick={retryLoadStores} className="btn btn-primary">Thử lại</button>
          </div>
        ) : showSkeleton ? (
          <SkeletonGrid />
        ) : searchResults.length === 0 ? (
          <EmptyState
            icon={<Search className="size-10 mx-auto mb-3 opacity-30" />}
            title="Không tìm thấy cửa hàng"
            description="Thử tìm với từ khác hoặc bớt bộ lọc"
          />
        ) : (
          <>
            <div className="store-grid">
              {visibleStores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  distance={store.distance}
                  onOpenDetail={handleOpenDetail}
                />
              ))}
            </div>
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-6 text-[13px] text-[var(--muted)]">
                <span>Đang tải thêm…</span>
              </div>
            )}
            {!hasMore && searchResults.length > BATCH_SIZE && (
              <div className="flex items-center justify-center py-4 text-[13px] text-[var(--muted)]">
                Đã hiển thị tất cả {searchResults.length} cửa hàng
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal / Sheet */}
      {isMobile ? (
        <StoreDetailSheet
          store={selectedStore}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      ) : (
        <StoreDetailModalSimple
          store={selectedStore}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}
    </div>
  )
}
