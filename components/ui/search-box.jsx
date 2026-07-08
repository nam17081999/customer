'use client'

import { Search, X } from 'lucide-react'

export function SearchBox({ value, onChange, placeholder = 'Tìm kiếm...', width, className = '', inputRef, onKeyDown, onFocus, onBlur }) {
  return (
    <div
      className={`flex items-center gap-2 bg-[color:var(--surface2)] border border-[color:var(--border)] rounded-sm px-3 h-11 transition-[border-color] duration-150 focus-within:border-[color:var(--accent)] ${className}`}
      style={width ? { width } : undefined}
    >
      <Search className="size-[14px] shrink-0 text-[color:var(--muted)]" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        className="bg-transparent border-none text-[color:var(--fg)] text-[13px] outline-none w-full h-full placeholder:text-[color:var(--muted)]"
      />
      {value && (
        <button
          type="button"
          className="inline-flex items-center justify-center size-[18px] rounded-full border-none bg-[color:var(--border)] text-[color:var(--muted)] cursor-pointer text-[11px] shrink-0 hover:bg-[color:color-mix(in_srgb,var(--border)_70%,var(--fg))] hover:text-[color:var(--fg)]"
          onClick={() => onChange('')}
          aria-label="Xoá"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}
