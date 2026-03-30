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
            "flex h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-base placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 text-gray-100",
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
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-gray-500 hover:bg-gray-700 hover:text-gray-200 focus:outline-none"
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
