import type { RequestKind, RequestStatus } from "@/lib/types";

export const requestKindLabels: Record<RequestKind, string> = {
  report_sick: "Report Sick",
  external_appointment: "External Appointment",
};

export const statusLabels: Record<RequestStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  needs_changes: "Needs changes",
  approved: "Approved",
  submitted: "Submitted",
  finalized: "Endorsed",
  rejected: "Rejected",
};

export const statusBadgeTone =
  "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700/60 dark:bg-zinc-900/70 dark:text-zinc-300";

export const statusDotTone: Record<RequestStatus, string> = {
  draft: "bg-zinc-500 dark:bg-zinc-400",
  pending: "bg-yellow-500 dark:bg-yellow-400",
  needs_changes: "bg-orange-500 dark:bg-orange-400",
  approved: "bg-green-500 dark:bg-green-400",
  submitted: "bg-violet-500 dark:bg-violet-400",
  finalized: "bg-blue-500 dark:bg-blue-400",
  rejected: "bg-rose-500 dark:bg-rose-400",
};

export const requestTypeDescription: Record<RequestKind, string> = {
  report_sick:
    "Submit the 5W1H sick report first, then add doctor-visit details after admin approval and wait for endorsement.",
  external_appointment:
    "Request permission for outside appointments and keep the approval or rejection trail in one place.",
};
