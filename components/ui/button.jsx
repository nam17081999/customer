import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-white cursor-pointer",
  {
    variants: {
      variant: {
        default:       "bg-gray-50 text-gray-900 hover:bg-gray-50/90",
        secondary:     "bg-gray-800 text-gray-50 hover:bg-gray-800/80",
        outline:       "border border-gray-700 text-gray-100 hover:bg-gray-800",
        ghost:         "hover:bg-gray-800 text-gray-100",
        link:          "text-blue-400 underline-offset-4 hover:underline",
        // Nút hành động chính (form submit, CTA nổi bật)
        primary:           "bg-blue-600 text-white hover:bg-blue-700 font-semibold",
        // Nút nguy hiểm - trạng thái bình thường (outline đỏ nhạt)
        destructive:       "border border-red-900/50 text-red-400 hover:bg-red-950/30 hover:border-red-900",
        // Nút nguy hiểm - trạng thái xác nhận (đỏ đậm, cần bấm lần 2)
        destructiveConfirm: "border border-red-500 text-red-500 bg-red-950/30 hover:bg-red-900/50",
        // Nút overlay trên ảnh/bản đồ (nền đen mờ, nội dung trắng, hình tròn)
        imageOverlay:       "bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm rounded-full",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm:      "h-11 px-3 text-sm",
        lg:      "h-12 px-8",
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
