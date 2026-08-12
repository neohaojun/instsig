import { format, parseISO } from "date-fns";
import { formatDisplayDateTime } from "@/lib/display-date";
import { formatCoursePlatoon } from "@/lib/batch-display";
import type { BatchRecord, ProfileRecord, RequestRecord, RequestUpdateRecord } from "@/lib/types";

function displayText(value: unknown, fallback = "Not set") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function compactDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Not set";

  try {
    return format(parseISO(value), "ddMMyy");
  } catch {
    return value;
  }
}

function statusTypeLabel(value: unknown) {
  if (value === "Light Duty") return "LD";
  if (value === "Rest in Bunk") return "RIB";
  return displayText(value);
}

function safetyLabel(value: unknown) {
  if (value === "Non-safety") return "Non-Safety";
  return displayText(value);
}

function formatStatusEntries(followup: RequestUpdateRecord | null | undefined) {
  const payload = followup?.payload as Record<string, unknown> | undefined;
  if (!payload) return null;
  if (payload.noStatusReceived === true) return "No status received";

  const entries = Array.isArray(payload.statusesReceived) ? payload.statusesReceived : [];
  const formatted = entries
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const value = entry as Record<string, unknown>;
      const days = typeof value.days === "number" ? value.days : Number(value.days);
      const dayLabel = Number.isFinite(days) && days > 0 ? `${days} Day` : "Status";
      return `${dayLabel} ${statusTypeLabel(value.type)} (${compactDate(value.startDate)}-${compactDate(value.endDate)})`;
    })
    .filter(Boolean);

  return formatted.length ? formatted.join(", ") : null;
}

export function formatRequesterDescription(
  requester: ProfileRecord | null | undefined,
  batch?: BatchRecord | null | undefined,
  adminLabel?: string | null,
) {
  if (adminLabel) return adminLabel;
  return formatCoursePlatoon(requester, batch) || "SCTW Permstaff";
}

export function formatRequestRequesterDescription(
  request: RequestRecord,
  requester: ProfileRecord | null | undefined,
  batch?: BatchRecord | null | undefined,
  adminLabel?: string | null,
) {
  if (adminLabel) return adminLabel;

  const payload = request.payload as Record<string, unknown>;
  const dateValue = request.kind === "report_sick" ? payload.dateReportingSick : payload.when;

  if (typeof dateValue === "string" && dateValue.trim()) {
    const requestDate = parseISO(dateValue);
    if (!Number.isNaN(requestDate.getTime())) {
      return formatCoursePlatoon(requester, batch, requestDate) || "SCTW Permstaff";
    }
  }

  return formatRequesterDescription(requester, batch);
}

export function buildRequestCardLines(request: RequestRecord, followup?: RequestUpdateRecord | null) {
  const payload = request.payload as Record<string, unknown>;

  if (request.kind === "report_sick") {
    const lines = [
      followup ? { label: "What", value: formatStatusEntries(followup) ?? "Not set" } : null,
      { label: "When", value: formatReportSickWhen(request) },
      { label: "Where", value: displayText(payload.where) },
      { label: "Why", value: displayText(payload.symptoms) },
      { label: "How", value: displayText(payload.contractionSource) },
    ].filter(Boolean) as { label: string; value: string }[];

    if (followup) {
      const followupPayload = followup.payload as Record<string, unknown>;
      lines.push(
        {
          label: "Swab test",
          value: `${displayText(followupPayload.swab)}, SA-ART: ${displayText(followupPayload.saArt)}, HA-ART: ${displayText(followupPayload.haArt)}, PCR: ${displayText(followupPayload.pcr)}`,
        },
        { label: "Incident nature", value: displayText(followupPayload.nature) },
        { label: "Non safety or safety incident", value: safetyLabel(followupPayload.safety) },
        { label: "Category", value: displayText(followupPayload.category) },
        { label: "Diagnosis", value: displayText(followupPayload.diagnosis, "Nil") },
        { label: "Medication", value: displayText(followupPayload.medication, "Nil") },
        { label: "Remarks", value: displayText(followupPayload.remarks, "Nil") },
      );
    }

    return lines;
  }

  return [
    { label: "What", value: displayText(payload.what) },
    { label: "When", value: formatExternalAppointmentWhen(request) },
    { label: "Where", value: displayText(payload.where) },
    { label: "Why", value: displayText(payload.why) },
    { label: "Lessons", value: displayText(payload.lessonsMissed) },
  ];
}

export function formatReportSickWhen(request: RequestRecord) {
  const payload = request.payload as Record<string, unknown>;
  const dateReportingSick = typeof payload.dateReportingSick === "string" ? payload.dateReportingSick : null;
  const timeReportingSick = typeof payload.timeReportingSick === "string" ? payload.timeReportingSick : null;

  if (dateReportingSick && timeReportingSick) {
    try {
      return `${format(parseISO(dateReportingSick), "dd/MM/yyyy")}, ${timeReportingSick}`;
    } catch {
      return `${dateReportingSick}, ${timeReportingSick}`;
    }
  }

  return "Date not set";
}

export function formatExternalAppointmentWhen(request: RequestRecord) {
  const payload = request.payload as Record<string, unknown>;
  const when = typeof payload.when === "string" ? payload.when : null;
  if (!when) return "Date not set";

  try {
    return formatDisplayDateTime(parseISO(when), "Date not set");
  } catch {
    return when;
  }
}
