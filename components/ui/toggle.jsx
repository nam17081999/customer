'use client'

export function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
      <div className="flex-1 min-w-0 mr-4">
        <div className="text-sm font-medium text-[var(--fg)]">{label}</div>
        {description && <div className="text-xs text-[var(--muted)] mt-0.5">{description}</div>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="w-10 h-5.5 bg-gray-700 rounded-full peer-checked:bg-accent after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-[18px]" />
      </label>
    </div>
  )
}
