// shim removed: keep original Input implementation
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(
  ({ className, type = 'text', value, onChange, disabled = false, readOnly = false, ...props }, ref) => {
    const showClear = type === 'text'
      && typeof value === 'string'
      && value.length > 0
      && typeof onChange === 'function'
      && !disabled
      && !readOnly

    return (
      <div className="relative w-full">
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-xl border border-slate-700/90 bg-slate-900/92 px-3.5 py-2 text-base text-slate-100 shadow-inner shadow-black/10 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50",
            showClear ? 'pr-9' : '',
            className
          )}
          ref={ref}
          value={value}
          onChange={onChange}
          disabled={disabled}
          readOnly={readOnly}
          {...props}
        />
        {showClear && (
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={() => onChange({ target: { value: '' } })}
            aria-label="Xóa nhanh"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor">
              <path d="M6 6l8 8M6 14L14 6" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    )
  }
);

Input.displayName = "Input";

export { Input };
