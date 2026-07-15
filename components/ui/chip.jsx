'use client'

import { cn } from '@/lib/utils'

export function Chip({ active, onClick, icon, children, className = '' }) {
  return (
    <button
      type="button"
      className={cn(
        'h-8 px-3 rounded-full text-[13px] font-medium cursor-pointer border bg-transparent border-gray-700 text-muted hover:bg-gray-800 hover:text-foreground transition-colors',
        active && 'bg-accent text-white border-accent hover:bg-accent hover:text-white',
        className
      )}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  )
}
