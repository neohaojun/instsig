"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function StrengthDatePicker({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange?: (value: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);

  function selectDate(date: Date | undefined) {
    if (!date) return;

    const nextValue = format(date, "yyyy-MM-dd");
    if (onValueChange) {
      onValueChange(nextValue);
    } else {
      router.replace(`/dashboard/strength?date=${nextValue}`);
    }
    setOpen(false);
  }

  return (
    <div className="ml-auto w-fit">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-11 shrink-0 px-0 min-[420px]:w-auto min-[420px]:px-4"
            aria-label={`Select strength date, currently ${format(selected, "dd MMMM yyyy")}`}
          >
            <CalendarDays className="h-4 w-4" />
            <span className="hidden min-[420px]:inline">{format(selected, "dd/MM/yyyy")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[18rem] max-w-[calc(100vw-2rem)]">
          <Calendar mode="single" selected={selected} onSelect={selectDate} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}
