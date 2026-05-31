export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-gray-800 text-gray-200 border-gray-700',
    success: 'bg-green-950/30 text-green-200 border-green-500/40',
    warning: 'bg-amber-950/30 text-amber-200 border-amber-500/40',
    error: 'bg-red-950/30 text-red-200 border-red-500/40',
    info: 'bg-blue-950/30 text-blue-200 border-blue-500/40',
    active: 'bg-blue-600/15 text-blue-300 border-blue-500/30',
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-medium ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  )
}
