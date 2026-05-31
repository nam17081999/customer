import React from 'react'

export default function FAB({ onClick, ariaLabel = 'Quick action', children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`fixed right-4 bottom-20 z-[1200] inline-flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-950/30 hover:brightness-95 active:scale-95 transition-transform ${className}`}
    >
      {children}
    </button>
  )
}
