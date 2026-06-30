'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

export function Pagination({ currentPage, totalPages, totalItems, itemLabel = 'mục', onPageChange }) {
  const pad2 = (n) => String(n).padStart(2, '0')

  const pageNumbers = useMemo(() => {
    const nums = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) nums.push(i)
    } else {
      nums.push(1)
      if (currentPage > 3) nums.push('...')
      for (let i = Math.max(2, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
        nums.push(i)
      }
      if (currentPage < totalPages - 2) nums.push('...')
      nums.push(totalPages)
    }
    return nums
  }, [currentPage, totalPages])

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          className="page-btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Trang trước"
        >
          ‹
        </button>

        <div className="flex items-center gap-1 overflow-x-auto">
          {pageNumbers.map((n, i) =>
            typeof n === 'string' ? (
              <span key={`e${i}`} className="page-ellipsis">…</span>
            ) : (
              <button
                key={n}
                className={cn('page-btn', n === currentPage && 'active')}
                onClick={() => onPageChange(n)}
              >
                {n}
              </button>
            )
          )}
        </div>

        <button
          className="page-btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Trang sau"
        >
          ›
        </button>
      </div>

      <span className="page-info">
        Trang {pad2(currentPage)}/{pad2(totalPages)} · {totalItems} {itemLabel}
      </span>
    </div>
  )
}
