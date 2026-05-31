export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      {icon ? (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
          {icon}
        </div>
      ) : (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
          <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      )}
      <p className="mb-1 text-base font-medium text-gray-200">{title}</p>
      {description && (
        <p className="mb-4 text-sm text-gray-400">{description}</p>
      )}
      {action && action}
    </div>
  )
}
