import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type = 'text', value, onChange, label, ...props }, ref) => {
  const showClear = type === 'text' && typeof value === 'string' && value.length > 0 && typeof onChange === 'function'
  return (
    <div className="relative w-full">
      {/* Label hien thi ro rang neu co */}
      {label && (
        <label className="block text-lg font-semibold text-gray-100 mb-2">
          {label}
        </label>
      )}
      <input
        type={type}
        className={cn(
          // Input lon hon - 56px height, font 18px, border day hon, contrast cao
          "flex h-14 w-full rounded-xl border-2 border-gray-600 bg-gray-900 px-4 py-3 text-lg text-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          showClear ? 'pr-12' : '',
          className
        )}
        ref={ref}
        value={value}
        onChange={onChange}
        {...props}
      />
      {/* Nut xoa lon hon, de nhan */}
      {showClear && (
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white focus:outline-none cursor-pointer transition-colors"
          onClick={() => onChange({ target: { value: '' } })}
          aria-label="Xoa noi dung"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      )}
    </div>
  )
});
Input.displayName = "Input";

export { Input };
