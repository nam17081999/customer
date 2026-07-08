'use client'

import { SlidersHorizontal, X } from 'lucide-react'

const selectBase = 'bg-[color:var(--bg)] border border-[color:var(--border)] text-[color:var(--fg)] outline-none cursor-pointer appearance-none focus:border-[color:var(--accent)]'
export const DESKTOP_SELECT = `${selectBase} h-8 text-[13px] pl-2.5 pr-7 rounded-sm min-w-[140px] max-md:min-w-0 max-md:w-full`
export const MOBILE_SELECT = `${selectBase} w-full h-10 rounded-sm px-3 text-[14px]`

export const DESKTOP_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.05em] text-[color:var(--muted)]'
export const MOBILE_LABEL = 'block text-[12px] font-semibold text-[color:var(--muted)] mb-2'

export const FILTER_CHIP_BASE = 'h-10 px-3 rounded-md border text-[13px] font-medium cursor-pointer transition-all duration-150 whitespace-nowrap inline-flex items-center justify-center'
export const FILTER_CHIP_INACTIVE = 'border-[color:var(--border)] bg-transparent text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]'
export const FILTER_CHIP_ACTIVE = 'bg-[color:var(--accent)] border-[color:var(--accent)] text-white'

export function FilterGroup({ label, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className={DESKTOP_LABEL}>{label}</label>
      {children}
    </div>
  )
}

export function MobileFilterGroup({ label, children, className = '' }) {
  return (
    <div className={`mb-4 ${className}`}>
      <label className={MOBILE_LABEL}>{label}</label>
      {children}
    </div>
  )
}

export function FilterToggle({ activeCount = 0, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 px-3 rounded-sm text-[13px] font-medium cursor-pointer border border-[color:var(--border)] bg-[color:var(--surface2)] text-[color:var(--muted)] h-11 relative transition-all duration-150 whitespace-nowrap hover:bg-[color:var(--surface)] hover:text-[color:var(--fg)] ${className}`}
      onClick={onClick}
      aria-label="Bộ lọc"
    >
      <SlidersHorizontal className="size-[14px]" />
      <span>Bộ lọc</span>
      {activeCount > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[color:var(--accent)] text-white text-[10px] font-bold leading-none">
          {activeCount}
        </span>
      )}
    </button>
  )
}

export function FilterClearBtn({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap no-underline bg-transparent border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)] ${className}`}
    >
      <X className="size-3" />
      Xóa lọc
    </button>
  )
}

export function FilterDesktopPanel({ open, onClear, children }) {
  if (!open) return null
  return (
    <div className="block mb-3">
      <div className="flex flex-wrap items-end gap-3 bg-[color:var(--surface)] border border-[color:var(--border)] rounded-sm p-3 px-4 max-md:flex-col max-md:items-stretch max-md:gap-2.5 max-md:p-3.5">
        {children}
        <div className="flex items-center pb-px">
          <FilterClearBtn onClick={onClear} />
        </div>
      </div>
    </div>
  )
}

export function FilterMobileSheet({ open, onClose, onClear, onApply, children }) {
  if (!open) return null
  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[55] transition-opacity duration-250"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 bg-[color:var(--surface)] rounded-t-lg z-60 max-h-[85vh] overflow-y-auto p-5 pb-0 max-sm:p-4">
        <div className="w-9 h-1 bg-[color:var(--border)] rounded-sm mx-auto mb-4 shrink-0" />
        <div className="text-[16px] font-bold mb-4">Bộ lọc</div>
        {children}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => { onClear?.(); onClose?.() }}
            className="flex-1 py-3 bg-[color:var(--border)] text-[color:var(--fg)] rounded-sm text-[15px] font-semibold cursor-pointer border-none"
          >
            Đặt lại
          </button>
          <button
            type="button"
            onClick={() => { onApply?.(); onClose?.() }}
            className="flex-[3] py-3 bg-[color:var(--accent)] text-white rounded-sm text-[15px] font-semibold cursor-pointer border-none"
          >
            Xem kết quả
          </button>
        </div>
      </div>
    </>
  )
}
