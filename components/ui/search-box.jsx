'use client'

import { Search, X } from 'lucide-react'

export function SearchBox({ value, onChange, placeholder = 'Tìm kiếm...', width, className = '' }) {
  return (
    <div
      className={`search-box ${className}`}
      style={width ? { width } : undefined}
    >
      <Search className="size-4 shrink-0 text-[var(--muted)]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          type="button"
          className="search-clear visible"
          onClick={() => onChange('')}
          aria-label="Xoá"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}
