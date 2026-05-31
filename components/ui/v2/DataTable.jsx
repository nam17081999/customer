import React from 'react'

export default function DataTable({ header, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden ${className}`}>
      {header ? <div className="sticky-table-header border-b border-slate-900 p-3 bg-slate-950/60">{header}</div> : null}
      <div className="p-2">{children}</div>
    </div>
  )
}
