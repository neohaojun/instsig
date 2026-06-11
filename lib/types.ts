export type RequestKind = "report_sick" | "external_appointment";

export type RequestUpdateKind = "doctor_followup";

export type RequestStatus =
  | "draft"
  | "pending"
  | "needs_changes"
  | "approved"
  | "submitted"
  | "finalized"
  | "rejected";

export type UserRole = "user" | "admin";

export type ReportSickStatusType =
  | "MC"
  | "Light Duty"
  | "Excuse RMJ"
  | "Excuse Heavy Load"
  | "Excuse Upper Limb"
  | "Excuse Lower Limb"
  | "Excuse Uniform"
  | "Excuse Boots"
  | "Excuse Covered Footwear"
  | "Excuse Camo";

export type ReportSickStatusEntry = {
  days: number;
  type: ReportSickStatusType;
  startDate: string;
  endDate: string;
};

export type ReportSickPayload = {
  dateReportingSick: string;
  timeReportingSick: string;
  where: string;
  symptoms: string;
  contractionSource: string;
};

export type ReportSickFollowupPayload = {
  diagnosis: string;
  noStatusReceived: boolean;
  statusesReceived: ReportSickStatusEntry[];
  swab: "Yes" | "No";
  saArt: "Positive" | "Negative" | "NIL";
  haArt: "Positive" | "Negative" | "NIL";
  pcr: "Positive" | "Negative" | "NIL";
  nature: "Musculoskeletal Injury" | "Near Miss" | "Others";
  safety: "Safety" | "Non-safety";
  category: "ARI" | "Non-ARI";
  medication: string;
  remarks: string;
};

export type ExternalAppointmentPayload = {
  what: string;
  where: string;
  when: string;
  lessonsMissed: string;
  why: string;
};

export type RequestRecord = {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  requester_id: string;
  requester_email: string;
  payload: ReportSickPayload | ExternalAppointmentPayload;
  review_note: string | null;
  suggested_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  followup_submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  finalized_by: string | null;
  finalized_at: string | null;
};

export type RequestUpdateRecord = {
  id: string;
  request_id: string;
  kind: RequestUpdateKind;
  payload: Record<string, unknown>;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRecord = {
  id: string;
  email: string;
  full_name: string | null;
  rank: string | null;
  role: UserRole;
  batch_id: string | null;
  common_term_platoon: string | null;
  sscc_batch: string | null;
  specialisation_phase_platoon: string | null;
  nr: string | null;
};

export type BatchRecord = {
  id: string;
  firestore_id: string | null;
  name: string;
  description: string | null;
  course_start: string | null;
  common_term_end: string | null;
  course_end: string | null;
  created_at: string;
  updated_at: string;
};
