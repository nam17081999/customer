'use client'

import { useEffect, useState } from 'react'

export default function PageShell({ children, maxWidth = 'max-w-screen-md', className = '' }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={`mx-auto h-full w-full ${maxWidth} ${className}`}>
        {children}
      </div>
    )
  }

  const isMobile = window.matchMedia('(max-width: 639px)').matches

  if (isMobile) {
    return (
      <div className={`mx-auto flex h-full max-w-screen-md flex-col overflow-hidden px-3 pt-4 ${className}`}>
        {children}
      </div>
    )
  }

  return (
    <div className={`mx-auto flex h-full w-full ${maxWidth} flex-col overflow-hidden px-4 py-4 2xl:px-6 ${className}`}>
      {children}
    </div>
  )
}
