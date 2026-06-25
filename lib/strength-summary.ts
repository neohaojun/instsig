import { isValid, parseISO, startOfDay } from "date-fns";
import { formatStatusDuration, getActiveReportSickStatuses } from "@/lib/active-report-sick-statuses";
import { formatDisplayDateTime } from "@/lib/display-date";
import type { ProfileRecord, RequestRecord, RequestUpdateRecord } from "@/lib/types";

export type StrengthSummary = {
  total: number;
  current: number;
  attendC: number;
  attendB: number;
  reportingSick: number;
  externalAppointment: number;
  guardDuty: number;
  onMedication: number;
  others: number;
};

export type StrengthCategoryKey =
  | "attendC"
  | "attendB"
  | "reportingSick"
  | "externalAppointment"
  | "guardDuty"
  | "onMedication"
  | "others";

export type StrengthCategoryEntry = {
  id: string;
  profileId: string;
  fallbackName: string;
  description: string;
  meta: string;
};

export type StrengthDetails = {
  summary: StrengthSummary;
  categories: Record<StrengthCategoryKey, StrengthCategoryEntry[]>;
};

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function isSameDate(value: string | null | undefined, date: Date) {
  const parsed = parseDate(value);
  if (!parsed) return false;
  return startOfDay(parsed).getTime() === startOfDay(date).getTime();
}

function isPersonnelProfile(profile: ProfileRecord) {
  return profile.role !== "admin";
}

function hasMedication(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().toLowerCase() !== "nil";
}

function formatWhen(value: string | null | undefined) {
  const parsed = parseDate(value);
  return parsed ? formatDisplayDateTime(parsed, "Date not set") : "Date not set";
}

export function buildStrengthSummary(
  profiles: ProfileRecord[],
  requests: RequestRecord[],
  updates: RequestUpdateRecord[],
  now: Date = new Date(),
): StrengthSummary {
  const personnelIds = new Set(profiles.filter(isPersonnelProfile).map((profile) => profile.id));
  const activeStatuses = getActiveReportSickStatuses(requests, updates, now).filter((status) =>
    personnelIds.has(status.request.requester_id),
  );

  const attendCIds = new Set(
    activeStatuses.filter((status) => status.entry.type === "MC").map((status) => status.request.requester_id),
  );
  const attendBIds = new Set(
    activeStatuses.filter((status) => status.entry.type !== "MC").map((status) => status.request.requester_id),
  );
  const activeStatusRequestIds = new Set(activeStatuses.map((status) => status.request.id));
  const onMedicationIds = new Set(
    updates
      .filter((update) => update.kind === "doctor_followup" && hasMedication(update.payload?.medication))
      .flatMap((update) => {
        const request = requests.find((item) => item.id === update.request_id);
        if (!request || !personnelIds.has(request.requester_id)) return [];
        if (!activeStatusRequestIds.has(request.id) && !isSameDate(request.followup_submitted_at, now)) return [];
        return [request.requester_id];
      }),
  );
  const reportingSickIds = new Set(
    requests
      .filter((request) => {
        if (request.kind !== "report_sick" || !personnelIds.has(request.requester_id)) return false;
        if (request.status === "draft" || request.status === "rejected" || request.status === "finalized") return false;
        const payload = request.payload as Record<string, unknown>;
        return isSameDate(typeof payload.dateReportingSick === "string" ? payload.dateReportingSick : null, now);
      })
      .map((request) => request.requester_id),
  );
  const externalAppointmentIds = new Set(
    requests
      .filter((request) => {
        if (request.kind !== "external_appointment" || !personnelIds.has(request.requester_id)) return false;
        if (request.status === "draft" || request.status === "rejected") return false;
        const payload = request.payload as Record<string, unknown>;
        return isSameDate(typeof payload.when === "string" ? payload.when : null, now);
      })
      .map((request) => request.requester_id),
  );
  const unavailableIds = new Set([...attendCIds, ...reportingSickIds, ...externalAppointmentIds]);

  return {
    total: personnelIds.size,
    current: Math.max(personnelIds.size - unavailableIds.size, 0),
    attendC: attendCIds.size,
    attendB: attendBIds.size,
    reportingSick: reportingSickIds.size,
    externalAppointment: externalAppointmentIds.size,
    guardDuty: 0,
    onMedication: onMedicationIds.size,
    others: 0,
  };
}

export function buildStrengthDetails(
  profiles: ProfileRecord[],
  requests: RequestRecord[],
  updates: RequestUpdateRecord[],
  now: Date = new Date(),
): StrengthDetails {
  const summary = buildStrengthSummary(profiles, requests, updates, now);
  const personnelIds = new Set(profiles.filter(isPersonnelProfile).map((profile) => profile.id));
  const activeStatuses = getActiveReportSickStatuses(requests, updates, now).filter((status) =>
    personnelIds.has(status.request.requester_id),
  );
  const activeStatusRequestIds = new Set(activeStatuses.map((status) => status.request.id));

  const categories: StrengthDetails["categories"] = {
    attendC: [],
    attendB: [],
    reportingSick: [],
    externalAppointment: [],
    guardDuty: [],
    onMedication: [],
    others: [],
  };

  activeStatuses.forEach((status) => {
    const entry = {
      id: `${status.request.id}-${status.entry.type}-${status.entry.startDate}-${status.entry.endDate}`,
      profileId: status.request.requester_id,
      fallbackName: status.request.requester_email,
      description: status.entry.type,
      meta: formatStatusDuration(status),
    };

    if (status.entry.type === "MC") {
      categories.attendC.push(entry);
    } else {
      categories.attendB.push(entry);
    }
  });

  requests.forEach((request) => {
    if (!personnelIds.has(request.requester_id)) return;

    if (request.kind === "report_sick") {
      const payload = request.payload as Record<string, unknown>;
      const dateReportingSick = typeof payload.dateReportingSick === "string" ? payload.dateReportingSick : null;
      if (
        request.status !== "draft" &&
        request.status !== "rejected" &&
        request.status !== "finalized" &&
        isSameDate(dateReportingSick, now)
      ) {
        categories.reportingSick.push({
          id: request.id,
          profileId: request.requester_id,
          fallbackName: request.requester_email,
          description: "Report Sick",
          meta: typeof payload.timeReportingSick === "string" ? payload.timeReportingSick : "Time not set",
        });
      }
    }

    if (request.kind === "external_appointment") {
      const payload = request.payload as Record<string, unknown>;
      const when = typeof payload.when === "string" ? payload.when : null;
      if (request.status !== "draft" && request.status !== "rejected" && isSameDate(when, now)) {
        categories.externalAppointment.push({
          id: request.id,
          profileId: request.requester_id,
          fallbackName: request.requester_email,
          description: typeof payload.where === "string" && payload.where.trim() ? payload.where : "External Appointment",
          meta: formatWhen(when),
        });
      }
    }
  });

  updates.forEach((update) => {
    if (update.kind !== "doctor_followup" || !hasMedication(update.payload?.medication)) return;
    const request = requests.find((item) => item.id === update.request_id);
    if (!request || !personnelIds.has(request.requester_id)) return;
    if (!activeStatusRequestIds.has(request.id) && !isSameDate(request.followup_submitted_at, now)) return;

    categories.onMedication.push({
      id: update.id,
      profileId: request.requester_id,
      fallbackName: request.requester_email,
      description: String(update.payload.medication),
      meta: "Medication declared",
    });
  });

  return { summary, categories };
}
