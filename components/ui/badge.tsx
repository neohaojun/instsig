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
        variant === "default" && "border-white/10 bg-white/10 text-zinc-100",
        variant === "secondary" && "border-white/10 bg-white/5 text-zinc-200",
        variant === "outline" && "border-white/10 bg-transparent text-zinc-200",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
