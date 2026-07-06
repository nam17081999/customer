'use client'

export function EmptyState({ icon, title, description, className = '' }) {
  return (
    <div className={`text-center py-16 ${className}`}>
      {icon}
      <h3 className="text-[16px] font-semibold text-[color:var(--fg)] mb-1">{title}</h3>
      {description && <p className="text-[14px] text-[color:var(--muted)]">{description}</p>}
    </div>
  )
}
