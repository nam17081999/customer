import { cn } from "@/lib/utils"

function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-5 py-4 border-b border-[var(--border)]",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn("text-[15px] font-semibold text-[var(--fg)]", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }) {
  return (
    <p
      className={cn("text-sm text-[var(--muted)]", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }) {
  return <div className={cn("p-5", className)} {...props} />
}

function CardFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-5 py-4 border-t border-[var(--border)]",
        className
      )}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
