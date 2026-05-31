import React from 'react'

export default function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-800/60 ${className}`} />
}
