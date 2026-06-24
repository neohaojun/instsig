"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ApprovalBanner({
  label,
  name,
  when,
  className,
}: {
  label: string;
  name: string;
  when: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-emerald-300 bg-emerald-50/90 px-5 py-4 text-emerald-950 shadow-[inset_0_1px_0_rgba(16,185,129,0.16)] dark:border-emerald-500/35 dark:bg-emerald-950/20 dark:text-emerald-200 dark:shadow-[inset_0_1px_0_rgba(74,222,128,0.12)]",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-7 text-emerald-700 dark:text-emerald-200">
            {label} by {name}
          </p>
          <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">on {when}</p>
        </div>
      </div>
    </div>
  );
}
