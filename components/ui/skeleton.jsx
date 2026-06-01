import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800", className)}
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
      {...props}
    />
  );
}

export { Skeleton };
