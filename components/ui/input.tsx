import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-input bg-background/60 px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-zinc-500 disabled:opacity-100 disabled:placeholder:text-zinc-600",
        type === "time" &&
          // Native time inputs have browser-specific chrome that makes empty fields look oversized or uneven.
          "appearance-none leading-normal [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-datetime-edit]:p-0",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
