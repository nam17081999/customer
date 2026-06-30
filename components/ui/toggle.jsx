'use client'

export function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
      <div className="flex-1 min-w-0 mr-4">
        <div className="text-sm font-medium text-[var(--fg)]">{label}</div>
        {description && <div className="text-xs text-[var(--muted)] mt-0.5">{description}</div>}
      </div>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-slider" />
      </label>
    </div>
  )
}
