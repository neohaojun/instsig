import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "outline" }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variant === "default" && "border-[#18181b] bg-[#18181b] text-white dark:border-white/10 dark:bg-white/10 dark:text-zinc-100",
        variant === "secondary" && "border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200",
        variant === "outline" && "border-zinc-200 bg-transparent text-zinc-700 dark:border-white/10 dark:text-zinc-200",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
