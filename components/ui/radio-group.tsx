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
              "flex min-h-9 cursor-pointer items-start gap-2.5 text-sm text-foreground",
              disabled && "cursor-not-allowed text-muted-foreground",
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
              className="mt-0.5 h-4 w-4 shrink-0 border-input bg-background accent-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed dark:accent-zinc-100"
            />
            <span className="min-w-0">
              <span className={cn("block leading-5", checked && "font-medium text-foreground")}>{option.label}</span>
              {option.description ? <span className="block text-xs leading-5 text-muted-foreground">{option.description}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
