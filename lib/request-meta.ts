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
  finalized: "Finalised",
  rejected: "Rejected",
};

export const statusTone: Record<RequestStatus, string> = {
  draft: "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700/60 dark:bg-zinc-900/70 dark:text-zinc-300",
  pending: "border-yellow-600/30 bg-yellow-50 text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300",
  needs_changes: "border-orange-600/30 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300",
  approved: "border-green-600/30 bg-green-50 text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300",
  submitted: "border-violet-600/30 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
  finalized: "border-blue-600/30 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  rejected: "border-rose-600/30 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
};

export const requestTypeDescription: Record<RequestKind, string> = {
  report_sick:
    "Submit the 5W1H sick report first, then add doctor-visit details after admin approval and wait for finalization.",
  external_appointment:
    "Request permission for outside appointments and keep the approval or rejection trail in one place.",
};
