import { differenceInCalendarDays, format, isValid, parseISO, startOfDay } from "date-fns";
import type { ReportSickStatusEntry, RequestRecord, RequestUpdateRecord } from "@/lib/types";

export type ActiveReportSickStatus = {
  request: RequestRecord;
  entry: ReportSickStatusEntry;
  remainingDays: number;
  totalDays: number;
};

function parseDateOnly(value: string) {
  const parsed = parseISO(value);
  return isValid(parsed) ? startOfDay(parsed) : null;
}

function normalizeStatusEntry(entry: unknown): ReportSickStatusEntry | null {
  if (!entry || typeof entry !== "object") return null;

  const candidate = entry as Partial<ReportSickStatusEntry>;
  if (typeof candidate.type !== "string" || typeof candidate.startDate !== "string" || typeof candidate.endDate !== "string") {
    return null;
  }

  const days = typeof candidate.days === "number" ? candidate.days : Number(candidate.days);
  if (!Number.isFinite(days) || days < 1) return null;

  return {
    days,
    type: candidate.type as ReportSickStatusEntry["type"],
    startDate: candidate.startDate,
    endDate: candidate.endDate,
  };
}

export function getActiveReportSickStatuses(
  requests: RequestRecord[],
  updates: RequestUpdateRecord[],
  now: Date = new Date(),
) {
  const today = startOfDay(now);
  const followupsByRequestId = new Map(
    updates.filter((update) => update.kind === "doctor_followup").map((update) => [update.request_id, update]),
  );

  return requests
    .filter((request) => request.kind === "report_sick" && request.status !== "rejected" && request.status !== "draft")
    .flatMap((request) => {
      const followup = followupsByRequestId.get(request.id);
      const entries = Array.isArray(followup?.payload?.statusesReceived) ? followup.payload.statusesReceived : [];

      return entries
        .map(normalizeStatusEntry)
        .filter((entry): entry is ReportSickStatusEntry => Boolean(entry))
        .flatMap((entry) => {
          const startDate = parseDateOnly(entry.startDate);
          const endDate = parseDateOnly(entry.endDate);
          if (!startDate || !endDate || today < startDate || today > endDate) return [];

          return [
            {
              request,
              entry,
              remainingDays: differenceInCalendarDays(endDate, today) + 1,
              totalDays: Math.max(entry.days, differenceInCalendarDays(endDate, startDate) + 1),
            },
          ];
        });
    })
    .sort((first, second) => {
      const firstEnd = Date.parse(first.entry.endDate);
      const secondEnd = Date.parse(second.entry.endDate);
      return firstEnd - secondEnd;
    });
}

export function formatStatusDuration(status: ActiveReportSickStatus) {
  const endDate = parseDateOnly(status.entry.endDate);
  const remaining = status.remainingDays === 1 ? "ends today" : `${status.remainingDays} days left`;
  const total = status.totalDays === 1 ? "1 day" : `${status.totalDays} days`;

  if (!endDate) return `${total}, ${remaining}`;
  return `${total}, ${remaining} until ${format(endDate, "dd/MM/yyyy")}`;
}
