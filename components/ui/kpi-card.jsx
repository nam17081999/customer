'use client'

import { cn } from '@/lib/utils'

export function KpiCard({ label, value, sub, accentColor, change, changeDir, children, className }) {
  return (
    <div
      className={cn(
        'bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-[18px_20px]',
        'relative overflow-hidden transition-colors hover:border-[color-mix(in_srgb,var(--border)_70%,var(--fg))]',
        className
      )}
    >
      {accentColor && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[var(--radius)]"
          style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }}
        />
      )}

      {label && (
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] mb-2">
          {label}
        </div>
      )}

      {value !== undefined && (
        <div
          className="text-[28px] font-bold tracking-[-0.03em] leading-[1.1]"
          style={accentColor ? { color: accentColor } : undefined}
        >
          {value}
        </div>
      )}

      {sub && (
        <div className="text-[12px] text-[var(--muted)] mt-1">
          {sub}
        </div>
      )}

      {change && (
        <div className={`kpi-change ${changeDir === 'down' ? 'down' : 'up'}`}>
          {changeDir === 'down' ? '↓' : '↑'} {change}
        </div>
      )}

      {children}
    </div>
  )
}

export function KpiGrid({ items }) {
  return (
    <div className="kpi-grid">
      {items.map((item, i) => (
        <KpiCard
          key={i}
          label={item.label}
          value={item.value}
          sub={item.subtitle}
          accentColor={item.shineColor || item.color}
          change={item.change}
          changeDir={item.changeDir}
        />
      ))}
    </div>
  )
}
