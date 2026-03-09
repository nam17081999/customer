import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Nut chinh - mau xanh noi bat, de nhan biet
        default:
          "bg-blue-500 text-white hover:bg-blue-400 shadow-lg shadow-blue-500/20",
        // Nut phu - xam sang
        secondary:
          "bg-gray-700 text-white hover:bg-gray-600",
        // Nut vien - de nhin tren nen toi
        outline:
          "border-2 border-gray-500 text-white hover:bg-gray-800 hover:border-gray-400",
        // Nut trong suot
        ghost: "hover:bg-gray-800 text-white",
        // Nut link
        link: "text-blue-400 underline-offset-4 hover:underline",
        // Nut nguy hiem (xoa)
        danger: "bg-red-600 text-white hover:bg-red-500",
        // Nut thanh cong (xanh la)
        success: "bg-green-600 text-white hover:bg-green-500",
      },
      size: {
        // Kich thuoc mac dinh lon hon - 56px de nhan
        default: "h-14 px-6 py-3",
        // Kich thuoc nho - van toi thieu 48px
        sm: "h-12 rounded-lg px-4 text-base",
        // Kich thuoc lon - 64px
        lg: "h-16 rounded-xl px-8 text-xl",
        // Icon button - 56px vuong
        icon: "h-14 w-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
