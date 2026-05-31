import React, { cloneElement, isValidElement } from 'react'

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  asChild = false,
  leftIcon,
  rightIcon,
  children,
  ...props
}) {
  const sizeClasses = size === 'sm' ? 'px-3 h-11 text-sm' : size === 'lg' ? 'px-4 h-12 text-base' : 'px-4 h-11 text-sm'
  const variantClasses = variant === 'primary'
    ? 'bg-primary text-white hover:brightness-95 border-transparent'
    : variant === 'destructive'
    ? 'bg-danger text-white hover:brightness-95 border-transparent'
    : 'bg-transparent border border-border text-text-primary hover:bg-gray-800'

  const base = joinClasses('inline-flex items-center gap-2 rounded-md font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] px-3', sizeClasses, variantClasses, className)

  if (asChild && isValidElement(children)) {
    return cloneElement(children, {
      className: joinClasses(children.props?.className, base),
      ...props,
    })
  }

  return (
    <button className={base} {...props}>
      {leftIcon ? <span className="flex items-center">{leftIcon}</span> : null}
      <span className="min-w-0">{children}</span>
      {rightIcon ? <span className="flex items-center">{rightIcon}</span> : null}
    </button>
  )
}

export default Button
