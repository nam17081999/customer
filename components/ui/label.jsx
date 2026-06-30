import * as React from "react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }) {
  return (
    <label
      className={cn(
        "text-sm font-medium text-[color:var(--muted)]",
        className
      )}
      {...props}
    />
  );
}

export { Label };
