import { format, parseISO } from "date-fns";
import { formatProfileName } from "@/lib/profile-display";
import type { ProfileRecord } from "@/lib/types";
import type { PlatoonStrength, StrengthCategoryEntry, StrengthDetails, StrengthSummary } from "@/lib/strength-summary";

export type StrengthMessageKind = "book-in" | "stay-in";

const defaultPermStaffNames = [
  "3SG DARREN WONG",
  "3SG DYLAN KOH",
  "3SG JEREMY TAN",
  "3SG NICHOLAS CHIO",
  "3SG NEO HAO JUN",
];
const defaultPermStaffTotal = 6;

function twoDigits(value: number) {
  return String(Math.max(value, 0)).padStart(2, "0");
}

function compactDate(value: string) {
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "ddMMyy");
}

function entriesForProfiles(entries: StrengthCategoryEntry[], profileIds: Set<string>) {
  return entries.filter((entry) => profileIds.has(entry.profileId));
}

function statusLines(entries: StrengthCategoryEntry[]) {
  const grouped = new Map<string, number>();
  entries.forEach((entry) => {
    const label = entry.description === "MC" ? "ATTC" : entry.description.toUpperCase();
    const until = entry.untilDate ? ` till ${compactDate(entry.untilDate)}` : "";
    const key = `${label}${until}`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  });
  return [...grouped.entries()]
    .sort(([first], [second]) => first.localeCompare(second, undefined, { numeric: true }))
    .map(([label, count]) => `${twoDigits(count)} x ${label}`);
}

function manualLines(entries: StrengthCategoryEntry[], fallback: string) {
  const grouped = new Map<string, number>();
  entries.forEach((entry) => {
    const label = entry.description && entry.description !== "Admin added" ? entry.description : fallback;
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  });
  return [...grouped.entries()].map(([label, count]) => `${twoDigits(count)} x ${label}`);
}

function unavailableCount(summary: StrengthSummary) {
  return summary.attendC + summary.reportingSick + summary.externalAppointment + summary.guardDuty + summary.others;
}

function breakdownLines(
  platoon: PlatoonStrength,
  details: StrengthDetails,
) {
  const ids = new Set(platoon.profileIds);
  const attendC = entriesForProfiles(details.categories.attendC, ids);
  const guardDuty = entriesForProfiles(details.categories.guardDuty, ids);
  const others = entriesForProfiles(details.categories.others, ids);
  const external = entriesForProfiles(details.categories.externalAppointment, ids);
  const present = Math.max(platoon.summary.total - unavailableCount(platoon.summary), 0);

  return [
    platoon.name,
    `(In Camp Str/Total Str): ${present}/${platoon.summary.total}`,
    ...manualLines(guardDuty, "GD"),
    ...manualLines(others, "Others"),
    ...manualLines(external, "External Appt"),
    ...statusLines(attendC),
  ];
}

export function buildStrengthMessage({
  kind,
  selectedDate,
  details,
  profilesById,
  permStaffTotal,
}: {
  kind: StrengthMessageKind;
  selectedDate: string;
  details: StrengthDetails;
  profilesById: Record<string, ProfileRecord | null | undefined>;
  permStaffTotal: number;
}) {
  const title = kind === "book-in" ? "Book-In Strength" : "Stay-In Strength";
  const batchName = details.summary.activeBatches.length ? `${details.summary.activeBatches.join(", ")} SSCC` : "SSCC";
  const summary = details.summary;
  const present = Math.max(summary.total - unavailableCount(summary), 0);
  const overviewNotes = [
    ...manualLines(details.categories.others, "Others"),
    ...manualLines(details.categories.externalAppointment, "External Appt"),
  ];
  const platoons = details.batches.flatMap((batch) => batch.platoons).filter((platoon) => platoon.name !== "Not set");
  const permStaff = details.categories.stayInPermStaff;
  const permStaffNames = permStaff.length
    ? permStaff.map((entry) => formatProfileName(profilesById[entry.profileId], entry.fallbackName).toUpperCase())
    : defaultPermStaffNames;
  const resolvedPermStaffTotal = permStaff.length ? permStaffTotal : defaultPermStaffTotal;

  return [
    `${title} for ${batchName} on ${compactDate(selectedDate)}`,
    "",
    `Total Str: ${summary.total}`,
    `Present Str: ${present}`,
    `Send Home: ${twoDigits(summary.externalAppointment)}`,
    `Guard Duty: ${twoDigits(summary.guardDuty)}`,
    `RSO: ${twoDigits(summary.attendC + summary.reportingSick)}`,
    `Others: ${twoDigits(summary.others)}`,
    ...overviewNotes,
    "",
    "SALS",
    ...platoons.flatMap((platoon) => ["", ...breakdownLines(platoon, details)]),
    "",
    "NSF Perm Staff:",
    `(In Camp Str/Total Str): ${permStaffNames.length}/${resolvedPermStaffTotal}`,
    ...permStaffNames,
  ].join("\n");
}
