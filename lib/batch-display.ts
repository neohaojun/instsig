import { isValid, parseISO, startOfDay } from "date-fns";
import type { BatchRecord, ProfileRecord } from "@/lib/types";

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? startOfDay(parsed) : null;
}

export function isBatchActiveOnDate(batch: BatchRecord | null | undefined, date: Date) {
  const courseStart = parseDate(batch?.course_start);
  const courseEnd = parseDate(batch?.course_end);
  if (!courseStart || !courseEnd) return false;

  const target = startOfDay(date);
  return target >= courseStart && target <= courseEnd;
}

export function getBatchPhase(batch: BatchRecord | null | undefined, date: Date = new Date()) {
  if (!isBatchActiveOnDate(batch, date)) return "outside" as const;
  const specialisationStart = parseDate(batch?.common_term_end);
  if (specialisationStart && startOfDay(date) >= specialisationStart) return "specialisation" as const;
  return "common" as const;
}

export function formatCoursePlatoon(
  profile: ProfileRecord | null | undefined,
  batch: BatchRecord | null | undefined,
  date: Date = new Date(),
) {
  if (!profile || !batch) return null;

  const phase = getBatchPhase(batch, date);
  if (phase === "specialisation") {
    return [batch.name, "SSCC", profile.sscc_batch, profile.specialisation_phase_platoon].filter(Boolean).join(" ");
  }
  const courseStart = parseDate(batch.course_start);
  if (phase === "common" || (courseStart && startOfDay(date) < courseStart)) {
    return [batch.name, "SSCC", profile.common_term_platoon].filter(Boolean).join(" ");
  }

  return [batch.name, "SSCC", profile.sscc_batch, profile.specialisation_phase_platoon ?? profile.common_term_platoon]
    .filter(Boolean)
    .join(" ");
}
