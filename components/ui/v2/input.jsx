import React from 'react'

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function Input({ className = '', ...props }) {
  const base = joinClasses('w-full rounded-md border border-border bg-surface px-3 py-2 text-base placeholder:text-muted focus:outline-none focus:border-primary', className)
  return <input className={base} {...props} />
}

export default Input
