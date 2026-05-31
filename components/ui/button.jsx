// shim removed: keep original Button implementation
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-base font-semibold tracking-[-0.01em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:       "bg-slate-50 text-slate-950 shadow-sm shadow-black/10 hover:bg-white",
        secondary:     "bg-slate-800 text-slate-50 shadow-sm hover:bg-slate-700",
        outline:       "border border-slate-700/80 bg-slate-950/40 text-slate-100 hover:border-slate-500 hover:bg-slate-800/80",
        ghost:         "text-slate-100 hover:bg-slate-800/80",
        link:          "text-blue-400 underline-offset-4 hover:underline",
        // Nút hành động chính (form submit, CTA nổi bật)
        primary:           "bg-blue-600 text-white shadow-lg shadow-blue-950/30 hover:bg-blue-500",
        // Nút nguy hiểm - trạng thái bình thường (outline đỏ nhạt)
        destructive:       "border border-red-900/50 text-red-400 hover:bg-red-950/30 hover:border-red-900",
        // Nút nguy hiểm - trạng thái xác nhận (đỏ đậm, cần bấm lần 2)
        destructiveConfirm: "border border-red-500 text-red-500 bg-red-950/30 hover:bg-red-900/50",
        // Nút overlay trên ảnh/bản đồ (nền đen mờ, nội dung trắng, hình tròn)
        imageOverlay:       "bg-black/45 hover:bg-black/65 text-white backdrop-blur-sm rounded-full",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm:      "h-10 px-3 text-sm",
        lg:      "h-12 px-7 text-lg",
        icon:    "h-11 w-11",
      },
    },
    compoundVariants: [
      // Link variant: bỏ chiều cao cố định để hiển thị inline như text
      { variant: "link", class: "h-auto px-0 py-0" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, icon, leftIcon, rightIcon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    function renderContent() {
      if (asChild) return children;           // Slot expects a single child element
      if (size === "icon") return icon ?? children; // Icon-only button
      return <>{leftIcon}{children}{rightIcon}</>;  // Default: optional icons + text
    }

    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {renderContent()}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
