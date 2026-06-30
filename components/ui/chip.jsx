'use client'

import { cn } from '@/lib/utils'

export function Chip({ active, onClick, icon, children, className = '' }) {
  return (
    <button
      type="button"
      className={cn('chip', active && 'active', className)}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  )
}
