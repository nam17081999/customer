export default function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-xl shadow-black/10 backdrop-blur-sm ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-gray-100 sm:text-3xl">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-base text-gray-400">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
