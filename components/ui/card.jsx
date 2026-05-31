import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-800/80 bg-slate-950/86 text-slate-50 shadow-xl shadow-black/18 ring-1 ring-white/[0.03] backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-1.5 p-4 sm:p-5", className)} {...props} />;
}

function CardTitle({ className, ...props }) {
  return (
    <h3 className={cn("text-xl font-semibold leading-tight tracking-[-0.02em] sm:text-2xl", className)} {...props} />
  );
}

function CardDescription({ className, ...props }) {
  return <p className={cn("text-sm text-slate-400", className)} {...props} />;
}

function CardContent({ className, ...props }) {
  return <div className={cn("p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  return <div className={cn("flex items-center p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
