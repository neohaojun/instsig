import * as React from "react";
import { cn } from "@/lib/utils";

export type RadioGroupOption = {
  value: string;
  label: string;
  description?: string;
};

type RadioGroupProps = {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  options: RadioGroupOption[];
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
  layout?: "row" | "wrap" | "grid";
};

export function RadioGroup({
  name,
  value,
  onValueChange,
  options,
  disabled,
  className,
  itemClassName,
  layout = "wrap",
}: RadioGroupProps) {
  return (
    <div
      role="radiogroup"
      className={cn(
        layout === "row" && "flex items-center gap-4",
        layout === "wrap" && "flex flex-wrap gap-3",
        layout === "grid" && "grid gap-3 sm:grid-cols-2",
        className,
      )}
    >
      {options.map((option) => {
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition",
              checked
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-foreground hover:bg-accent",
              disabled && "cursor-not-allowed opacity-60",
              itemClassName,
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onValueChange(option.value)}
              className="sr-only"
            />
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                checked ? "border-zinc-100" : "border-zinc-500",
              )}
              aria-hidden="true"
            >
              <span className={cn("h-2 w-2 rounded-full", checked ? "bg-zinc-100" : "bg-transparent")} />
            </span>
            <span className="min-w-0">
              <span className="block font-medium leading-5 text-inherit">{option.label}</span>
              {option.description ? <span className="block text-xs leading-5 text-muted-foreground">{option.description}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
