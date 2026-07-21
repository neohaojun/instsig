import { isValid, parseISO, startOfDay } from "date-fns";
import {
  formatStatusDuration,
  getActiveReportSickStatuses,
  getPostReportSickStatuses,
} from "@/lib/active-report-sick-statuses";
import { formatDisplayDateTime } from "@/lib/display-date";
import { getBatchPhase, isBatchActiveOnDate } from "@/lib/batch-display";
import type { BatchRecord, ProfileRecord, RequestRecord, RequestUpdateRecord, StrengthManualRecord } from "@/lib/types";

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
  activeBatches: string[];
};

export type PlatoonStrength = {
  name: string;
  profileIds: string[];
  summary: StrengthSummary;
};

export type BatchStrength = {
  id: string;
  name: string;
  phase: "common" | "specialisation";
  courseStart: string | null;
  courseEnd: string | null;
  platoons: PlatoonStrength[];
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
  batches: BatchStrength[];
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

export function isStrengthPersonnelProfile(
  profile: ProfileRecord,
  batchesById: Record<string, BatchRecord | null | undefined>,
  date: Date,
) {
  const oocDate = parseDate(profile.ooc_date);
  const isOoc = oocDate ? startOfDay(date).getTime() >= startOfDay(oocDate).getTime() : false;
  return profile.role !== "admin" && !isOoc && Boolean(profile.batch_id && isBatchActiveOnDate(batchesById[profile.batch_id], date));
}

function formatWhen(value: string | null | undefined) {
  const parsed = parseDate(value);
  return parsed ? formatDisplayDateTime(parsed, "Date not set") : "Date not set";
}

function getManualRecordsForDate(
  records: StrengthManualRecord[],
  category: StrengthManualRecord["category"],
  personnelIds: Set<string>,
  date: Date,
) {
  return records.filter(
    (record) => record.category === category && personnelIds.has(record.profile_id) && isSameDate(record.duty_date, date),
  );
}

export function buildStrengthSummary(
  profiles: ProfileRecord[],
  requests: RequestRecord[],
  updates: RequestUpdateRecord[],
  batchesById: Record<string, BatchRecord | null | undefined>,
  manualRecords: StrengthManualRecord[] = [],
  now: Date = new Date(),
): StrengthSummary {
  const personnel = profiles.filter((profile) => isStrengthPersonnelProfile(profile, batchesById, now));
  const personnelIds = new Set(personnel.map((profile) => profile.id));
  const activeStatuses = getActiveReportSickStatuses(requests, updates, now).filter((status) =>
    personnelIds.has(status.request.requester_id),
  );
  const postStatuses = getPostReportSickStatuses(requests, updates, now).filter((status) =>
    personnelIds.has(status.request.requester_id),
  );

  const attendCIds = new Set(
    activeStatuses.filter((status) => status.entry.type === "MC").map((status) => status.request.requester_id),
  );
  const attendBIds = new Set(
    [
      ...activeStatuses.filter((status) => status.entry.type !== "MC"),
      ...postStatuses.filter((status) => status.entry.type === "MC" && status.daysAfterEnd === 1),
    ].map((status) => status.request.requester_id),
  );
  const guardDutyIds = new Set(getManualRecordsForDate(manualRecords, "guard_duty", personnelIds, now).map((record) => record.profile_id));
  const onMedicationIds = new Set(getManualRecordsForDate(manualRecords, "on_medication", personnelIds, now).map((record) => record.profile_id));
  const otherIds = new Set(getManualRecordsForDate(manualRecords, "others", personnelIds, now).map((record) => record.profile_id));
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
    guardDuty: guardDutyIds.size,
    onMedication: onMedicationIds.size,
    others: otherIds.size,
    activeBatches: Array.from(
      new Set(
        Object.values(batchesById)
          .filter((batch): batch is BatchRecord => Boolean(batch && isBatchActiveOnDate(batch, now)))
          .map((batch) => batch.name),
      ),
    ).sort((a, b) => a.localeCompare(b)),
  };
}

export function buildStrengthDetails(
  profiles: ProfileRecord[],
  requests: RequestRecord[],
  updates: RequestUpdateRecord[],
  batchesById: Record<string, BatchRecord | null | undefined>,
  manualRecords: StrengthManualRecord[] = [],
  now: Date = new Date(),
): StrengthDetails {
  const summary = buildStrengthSummary(profiles, requests, updates, batchesById, manualRecords, now);
  const personnelIds = new Set(profiles.filter((profile) => isStrengthPersonnelProfile(profile, batchesById, now)).map((profile) => profile.id));
  const activeStatuses = getActiveReportSickStatuses(requests, updates, now).filter((status) =>
    personnelIds.has(status.request.requester_id),
  );
  const postStatuses = getPostReportSickStatuses(requests, updates, now).filter((status) =>
    personnelIds.has(status.request.requester_id),
  );

  const batches = Object.values(batchesById)
    .filter((batch): batch is BatchRecord => Boolean(batch && isBatchActiveOnDate(batch, now)))
    .map((batch) => {
      const phase = getBatchPhase(batch, now) === "specialisation" ? "specialisation" : "common";
      const batchProfiles = profiles.filter((profile) => profile.batch_id === batch.id && isStrengthPersonnelProfile(profile, batchesById, now));
      const platoonNames = Array.from(
        new Set(
          batchProfiles.map((profile) =>
            (phase === "specialisation" ? profile.specialisation_phase_platoon : profile.common_term_platoon)?.trim() || "Not set",
          ),
        ),
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      return {
        id: batch.id,
        name: batch.name,
        phase,
        courseStart: batch.course_start,
        courseEnd: batch.course_end,
        platoons: platoonNames.map((name) => ({
          name,
          profileIds: batchProfiles
            .filter(
              (profile) =>
                ((phase === "specialisation" ? profile.specialisation_phase_platoon : profile.common_term_platoon)?.trim() || "Not set") ===
                name,
            )
            .map((profile) => profile.id),
          summary: buildStrengthSummary(
            batchProfiles.filter(
              (profile) =>
                ((phase === "specialisation" ? profile.specialisation_phase_platoon : profile.common_term_platoon)?.trim() || "Not set") ===
                name,
            ),
            requests,
            updates,
            batchesById,
            manualRecords,
            now,
          ),
        })),
      } satisfies BatchStrength;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

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

  postStatuses.forEach((status) => {
    const abbreviation = status.entry.type === "MC" ? "MC" : "LD";
    const label = `${abbreviation}+${status.daysAfterEnd}`;
    const entry = {
      id: `${status.request.id}-${status.entry.type}-${status.entry.endDate}-${label}`,
      profileId: status.request.requester_id,
      fallbackName: status.request.requester_email,
      description: label,
      meta: `Status ended ${status.entry.endDate}`,
    };

    if (label === "MC+1") {
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

  manualRecords.forEach((record) => {
    if (!personnelIds.has(record.profile_id) || !isSameDate(record.duty_date, now)) return;
    const categoryKey =
      record.category === "guard_duty" ? "guardDuty" : record.category === "on_medication" ? "onMedication" : "others";
    categories[categoryKey].push({
      id: record.id,
      profileId: record.profile_id,
      fallbackName: "Personnel",
      description: record.note?.trim() || "Admin added",
      meta: "Manual strength record",
    });
  });

  return { summary, batches, categories };
}
