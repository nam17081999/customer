import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Msg } from '@/components/ui/msg'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchBox } from '@/components/ui/search-box'
import { FilterToggle, FilterClearBtn, FilterDesktopPanel, FilterMobileSheet, FilterGroup, MobileFilterGroup, DESKTOP_SELECT, MOBILE_SELECT, FILTER_CHIP_BASE, FILTER_CHIP_INACTIVE, FILTER_CHIP_ACTIVE } from '@/components/ui/filter-layout'
import { SkeletonGrid } from '@/components/ui/skeleton'
import StoreCard from '@/components/store/store-card'
import StoreDetailModalSimple from '@/components/store/store-detail-modal-simple'
import StoreDetailSheet from '@/components/store/store-detail-sheet'
import { STORE_TYPE_OPTIONS, DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'
import { useHomeSearchController } from '@/helper/useHomeSearchController'
import { FILTER_FLAG_HAS_PHONE, FILTER_FLAG_POTENTIAL } from '@/helper/homeSearch'

const DISTRICTS = Object.keys(DISTRICT_WARD_SUGGESTIONS).sort((a, b) => a.localeCompare(b, 'vi'))
const ALL_WARDS = Array.from(new Set(Object.values(DISTRICT_WARD_SUGGESTIONS).flat())).sort((a, b) => a.localeCompare(b, 'vi'))
const BATCH_SIZE = 20

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
    toggleFilterValue,
    searchResults,
    handleCreateStoreClick,
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

  /* ── Reset display count + scroll to top when filters/search change ── */
  useEffect(() => {
    setDisplayCount(BATCH_SIZE)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
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

  const hasActiveFilters = activeFilterCount > 0

  const chipCls = (active) => `${FILTER_CHIP_BASE} ${active ? FILTER_CHIP_ACTIVE : FILTER_CHIP_INACTIVE}`

  const desktopFilterContent = (
    <>
      <FilterGroup label="Quận/Huyện">
        <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedWard('') }}
          className={DESKTOP_SELECT}
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' fill=\'%23888\'%3E%3Cpath d=\'M0 0l5 6 5-6z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
          <option value="">Tất cả</option>
          {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </FilterGroup>
      <FilterGroup label="Xã/Phường">
        <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)}
          className={DESKTOP_SELECT}
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' fill=\'%23888\'%3E%3Cpath d=\'M0 0l5 6 5-6z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
          <option value="">{selectedDistrict ? 'Tất cả xã' : 'Tất cả xã/phường'}</option>
          {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </FilterGroup>
      <FilterGroup label="Trạng thái">
        <select value={activeStatus === 'all' ? '' : activeStatus} onChange={(e) => handleStatusChange(e.target.value)}
          className={DESKTOP_SELECT}
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' fill=\'%23888\'%3E%3Cpath d=\'M0 0l5 6 5-6z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
          <option value="">Tất cả</option>
          <option value="active">Đã XT</option>
          <option value="inactive">Chưa XT</option>
        </select>
      </FilterGroup>
      <FilterGroup label="Loại CH">
        <select value={selectedStoreType} onChange={(e) => handleStoreTypeChange(e.target.value)}
          className={DESKTOP_SELECT}
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' fill=\'%23888\'%3E%3Cpath d=\'M0 0l5 6 5-6z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
          <option value="">Tất cả</option>
          {STORE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </FilterGroup>
      <FilterGroup label="Sắp xếp">
        <select value={sortBy === 'distance' ? '' : sortBy === 'newest' ? 'date' : sortBy} onChange={(e) => handleSortChange(e.target.value)}
          className={DESKTOP_SELECT}
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' fill=\'%23888\'%3E%3Cpath d=\'M0 0l5 6 5-6z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
          <option value="">Mặc định</option>
          <option value="name">Tên A-Z</option>
          <option value="date">Mới nhất</option>
        </select>
      </FilterGroup>
      <FilterGroup label="Chi tiết">
        <div className="flex gap-2">
          <button type="button" onClick={() => toggleFilterValue(setSelectedDetailFlags, FILTER_FLAG_HAS_PHONE)} aria-pressed={selectedDetailFlags.includes(FILTER_FLAG_HAS_PHONE)} className={chipCls(selectedDetailFlags.includes(FILTER_FLAG_HAS_PHONE))}>
            Có SĐT
          </button>
          <button type="button" onClick={() => toggleFilterValue(setSelectedDetailFlags, FILTER_FLAG_POTENTIAL)} aria-pressed={selectedDetailFlags.includes(FILTER_FLAG_POTENTIAL)} className={chipCls(selectedDetailFlags.includes(FILTER_FLAG_POTENTIAL))}>
            Tiềm năng
          </button>
        </div>
      </FilterGroup>
    </>
  )

  const mobileFilterContent = (
    <>
      <MobileFilterGroup label="Quận/Huyện">
        <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedWard('') }} className={MOBILE_SELECT}>
          <option value="">Tất cả</option>
          {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </MobileFilterGroup>
      <MobileFilterGroup label="Xã/Phường">
        <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)} className={MOBILE_SELECT}>
          <option value="">{selectedDistrict ? 'Tất cả xã' : 'Tất cả xã/phường'}</option>
          {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </MobileFilterGroup>
      <MobileFilterGroup label="Trạng thái">
        <select value={activeStatus === 'all' ? '' : activeStatus} onChange={(e) => handleStatusChange(e.target.value)} className={MOBILE_SELECT}>
          <option value="">Tất cả</option>
          <option value="active">Đã XT</option>
          <option value="inactive">Chưa XT</option>
        </select>
      </MobileFilterGroup>
      <MobileFilterGroup label="Loại CH">
        <select value={selectedStoreType} onChange={(e) => handleStoreTypeChange(e.target.value)} className={MOBILE_SELECT}>
          <option value="">Tất cả</option>
          {STORE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </MobileFilterGroup>
      <MobileFilterGroup label="Sắp xếp">
        <select value={sortBy === 'distance' ? '' : sortBy === 'newest' ? 'date' : sortBy} onChange={(e) => handleSortChange(e.target.value)} className={MOBILE_SELECT}>
          <option value="">Mặc định</option>
          <option value="name">Tên A-Z</option>
          <option value="date">Mới nhất</option>
        </select>
      </MobileFilterGroup>
      <MobileFilterGroup label="Chi tiết">
        <div className="flex gap-2">
          <button type="button" onClick={() => toggleFilterValue(setSelectedDetailFlags, FILTER_FLAG_HAS_PHONE)} aria-pressed={selectedDetailFlags.includes(FILTER_FLAG_HAS_PHONE)} className={`flex-1 ${chipCls(selectedDetailFlags.includes(FILTER_FLAG_HAS_PHONE))}`}>
            Có SĐT
          </button>
          <button type="button" onClick={() => toggleFilterValue(setSelectedDetailFlags, FILTER_FLAG_POTENTIAL)} aria-pressed={selectedDetailFlags.includes(FILTER_FLAG_POTENTIAL)} className={`flex-1 ${chipCls(selectedDetailFlags.includes(FILTER_FLAG_POTENTIAL))}`}>
            Tiềm năng
          </button>
        </div>
      </MobileFilterGroup>
    </>
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>

      {/* Toolbar */}
      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        <SearchBox
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Tìm tên CH hoặc SĐT..."
          inputRef={searchInputRef}
          className="w-[260px] max-[1100px]:flex-1 max-[1100px]:min-w-[120px]"
        />

        <FilterToggle activeCount={activeFilterCount} onClick={toggleFilter} />

        {hasActiveFilters && (
          <FilterClearBtn onClick={handleResetFilters} />
        )}

      </div>

      <FilterDesktopPanel open={showFilterPanel} onClear={handleResetFilters}>
        {desktopFilterContent}
      </FilterDesktopPanel>

      <FilterMobileSheet
        open={showFilterSheet}
        onClose={closeFilterSheet}
        onClear={clearAllFilters}
        onApply={closeFilterSheet}
      >
        {mobileFilterContent}
      </FilterMobileSheet>

      {/* Results info */}
      <div className="flex items-center gap-2 flex-wrap mb-3 shrink-0" style={{ minHeight: '1.25rem' }}>
        {showSkeleton ? (
          <div className="h-[13px] w-[260px] rounded bg-[color:var(--surface2)] animate-pulse" />
        ) : searchResults.length > 0 ? (
          <p className="text-[13px] text-[color:var(--muted)]">
            {hasSearchCriteria ? (
              <>Tìm thấy <span className="font-semibold text-[color:var(--fg)]">{searchResults.length}</span> cửa hàng</>
            ) : (
              <>Đang hiển thị <span className="font-semibold text-[color:var(--fg)]">{searchResults.length}</span> cửa hàng</>
            )}
          </p>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth" ref={scrollRef} style={{ overscrollBehavior: 'contain', overflowAnchor: 'none' }}>
        {hasError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-[color:var(--red)]/10 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[color:var(--red)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[14px] font-medium text-[color:var(--red)] mb-3">Không thể tải dữ liệu. Vui lòng thử lại.</p>
            <button type="button" onClick={retryLoadStores} className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-[color:var(--accent)] text-white hover:brightness-110">Thử lại</button>
          </div>
        ) : showSkeleton ? (
          <SkeletonGrid isMobile={isMobile} />
        ) : searchResults.length === 0 ? (
          <EmptyState
            icon={<Search className="size-10 mx-auto mb-3 opacity-30" />}
            title="Không tìm thấy cửa hàng"
            description="Thử tìm với từ khác hoặc bớt bộ lọc"
          />
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3 max-md:grid-cols-1">
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
              <div ref={sentinelRef} className="flex items-center justify-center py-6 text-[13px] text-[color:var(--muted)]">
                <span>Đang tải thêm…</span>
              </div>
            )}
            {!hasMore && searchResults.length > BATCH_SIZE && (
              <div className="flex items-center justify-center py-4 text-[13px] text-[color:var(--muted)]">
                Đã hiển thị tất cả {searchResults.length} cửa hàng
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={handleCreateStoreClick}
        aria-label="Thêm cửa hàng"
        className="fixed bottom-5 right-5 z-50 size-12 rounded-full border border-gray-600/60 bg-gray-800/80 text-gray-300 shadow-xl shadow-black/40 grid place-items-center hover:bg-gray-700 active:scale-95 backdrop-blur-sm transition"
      >
        <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

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
