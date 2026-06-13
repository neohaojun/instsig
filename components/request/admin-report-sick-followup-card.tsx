"use client";

import type { ProfileRecord, RequestUpdateRecord } from "@/lib/types";
import { ReportSickFollowupCard } from "@/components/request/report-sick-followup-display";

export function AdminReportSickFollowupCard({
  followup,
  profilesById = {},
}: {
  followup: RequestUpdateRecord;
  profilesById?: Record<string, ProfileRecord | null | undefined>;
}) {
  return (
    <ReportSickFollowupCard
      followup={followup}
      profilesById={profilesById}
      headerClassName="p-8"
      contentClassName="p-8 pt-0"
      idPrefix="admin-report-sick-followup"
    />
  );
}
