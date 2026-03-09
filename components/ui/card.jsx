import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        // Card NEN SANG HON, border noi bat
        "rounded-2xl border-2 border-gray-500 bg-gray-700 text-white shadow-xl",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }) {
  // Padding lon hon
  return <div className={cn("flex flex-col space-y-2 p-5", className)} {...props} />;
}

function CardTitle({ className, ...props }) {
  return (
    // Font lon hon, do tuong phan cao hon
    <h3 className={cn("text-xl font-bold leading-tight text-white", className)} {...props} />
  );
}

function CardDescription({ className, ...props }) {
  // Text lon hon, mau SANG HON de de doc
  return <p className={cn("text-base text-gray-100", className)} {...props} />;
}

function CardContent({ className, ...props }) {
  // Padding lon hon
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  // Padding lon hon
  return <div className={cn("flex items-center p-5 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
