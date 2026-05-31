export default function Section({ title, children, className = '' }) {
  return (
    <div className={className}>
      {title && (
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-sky-300/90">
          {title}
        </h2>
      )}
      {children}
    </div>
  )
}
