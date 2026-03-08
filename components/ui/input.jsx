import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type = 'text', value, onChange, ...props }, ref) => {
  const showClear = type === 'text' && typeof value === 'string' && value.length > 0 && typeof onChange === 'function'
  return (
    <div className="relative w-full">
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-base ring-offset-background placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-gray-100",
          showClear ? 'pr-9' : '',
          className
        )}
        ref={ref}
        value={value}
        onChange={onChange}
        {...props}
      />
      {showClear && (
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-200 focus:outline-none cursor-pointer"
          onClick={() => onChange({ target: { value: '' } })}
          aria-label="Xoá nhanh"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M6 6l8 8M6 14L14 6" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      )}
    </div>
  )
});
Input.displayName = "Input";

export { Input };
