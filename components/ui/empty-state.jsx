'use client'

export function EmptyState({ icon, title, description, className = '' }) {
  return (
    <div className={`empty-state ${className}`}>
      {icon}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  )
}
