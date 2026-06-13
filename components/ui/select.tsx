import * as React from "react";
import { cn } from "@/lib/utils";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, style, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-11 w-full cursor-pointer appearance-none rounded-xl border border-input bg-background bg-no-repeat px-4 py-2 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%23838b98' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 8 5 5 5-5'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.9rem center",
        backgroundSize: "0.95rem 0.95rem",
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export { Select };
