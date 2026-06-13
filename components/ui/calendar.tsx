"use client";

import * as React from "react";
import {
  addMonths,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  endOfMonth,
  endOfWeek,
  addDays,
  startOfDay,
  parseISO,
  isValid,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function Calendar({
  mode = "single",
  selected,
  onSelect,
  initialFocus,
  disableFuture = true,
}: {
  mode?: "single";
  selected?: Date | null;
  onSelect?: (date: Date | undefined) => void;
  initialFocus?: boolean;
  disableFuture?: boolean;
}) {
  const [month, setMonth] = React.useState(() => selected ?? new Date());
  const today = React.useMemo(() => startOfDay(new Date()), []);

  React.useEffect(() => {
    if (initialFocus && selected) {
      setMonth(selected);
    }
  }, [initialFocus, selected]);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const weeks: Date[][] = [];
  let current = startDate;
  while (current <= endDate) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(current);
      current = addDays(current, 1);
    }
    weeks.push(week);
  }

  return (
    <div className="w-full max-w-[20rem] select-none">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={() => setMonth((value) => subMonths(value, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium text-foreground">{format(month, "MMMM yyyy")}</p>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={() => setMonth((value) => addMonths(value, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const isCurrentMonth = isSameMonth(day, month);
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isToday = isSameDay(day, today);
          const isFuture = isAfter(day, today);
          const isDisabled = isBefore(day, monthStart) || isAfter(day, monthEnd) || (disableFuture && isFuture);
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect?.(day)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg text-sm transition",
                isCurrentMonth && (!isFuture || !disableFuture) ? "text-foreground hover:bg-accent" : "text-muted-foreground",
                isToday && !isSelected && "border border-border bg-accent text-accent-foreground",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                disableFuture && isFuture && "cursor-not-allowed text-muted-foreground opacity-50 hover:bg-transparent",
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { toDate };
