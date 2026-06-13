"use client";

import type { ProfileRecord, RequestRecord, RequestUpdateRecord } from "@/lib/types";
import { ReportSickFollowupCard } from "@/components/request/report-sick-followup-display";

export function AdminReportSickFollowupCard({
  request,
  followup,
  profilesById = {},
}: {
  request: RequestRecord;
  followup: RequestUpdateRecord;
  profilesById?: Record<string, ProfileRecord | null | undefined>;
}) {
  return (
    <ReportSickFollowupCard
      request={request}
      followup={followup}
      profilesById={profilesById}
      headerClassName="p-8"
      contentClassName="p-8 pt-0"
      idPrefix="admin-report-sick-followup"
    />
  );
}
