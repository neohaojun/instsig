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
  draft: "border-zinc-700/60 bg-zinc-900/70 text-zinc-300",
  pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  needs_changes: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  approved: "border-green-500/30 bg-green-500/10 text-green-300",
  submitted: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  finalized: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  rejected: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

export const requestTypeDescription: Record<RequestKind, string> = {
  report_sick:
    "Submit the 5W1H sick report first, then add doctor-visit details after admin approval and wait for finalization.",
  external_appointment:
    "Request permission for outside appointments and keep the approval or rejection trail in one place.",
};
