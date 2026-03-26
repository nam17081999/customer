'use client'

import { useEffect, useRef, useState } from 'react'

export function OverflowMarquee({ text, children, className = '', textClassName = '', contentKey }) {
  const containerRef = useRef(null)
  const textRef = useRef(null)
  const [overflowDistance, setOverflowDistance] = useState(0)
  const content = children ?? text ?? ''

  useEffect(() => {
    const container = containerRef.current
    const textNode = textRef.current
    if (!container || !textNode) return

    const measure = () => {
      const nextOverflow = Math.max(0, Math.ceil(textNode.scrollWidth - container.clientWidth))
      setOverflowDistance(nextOverflow)
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(textNode)

    return () => observer.disconnect()
  }, [contentKey, text, children])

  const shouldAnimate = overflowDistance > 8
  const duration = `${Math.min(Math.max(overflowDistance / 28, 3.5), 10)}s`

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className}`}>
      <span
        ref={textRef}
        className={`inline-block ${shouldAnimate ? 'store-name-marquee' : ''} ${textClassName}`}
        style={
          shouldAnimate
            ? {
                '--overflow-distance': `${overflowDistance}px`,
                '--overflow-duration': duration,
              }
            : undefined
        }
      >
        {content}
      </span>
    </div>
  )
}
