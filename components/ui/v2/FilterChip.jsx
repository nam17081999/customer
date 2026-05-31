export default function FilterChip({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
        active
          ? 'border-sky-500 bg-sky-500/15 text-sky-100'
          : 'border-slate-700 bg-slate-900 text-gray-300 hover:bg-slate-800'
      } ${className}`}
    >
      {children}
    </button>
  )
}
