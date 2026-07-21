"use client";

import { useState } from "react";
import type { ProfileRecord, RequestRecord, RequestUpdateRecord } from "@/lib/types";
import { ReportSickFollowupCard } from "@/components/request/report-sick-followup-display";
import { ReportSickFollowupForm } from "@/components/request/report-sick-followup-form";
import { Button } from "@/components/ui/button";

export function AdminReportSickFollowupCard({
  request,
  followup,
  profilesById = {},
  adminId,
  adminEmail,
  onSaved,
}: {
  request: RequestRecord;
  followup: RequestUpdateRecord;
  profilesById?: Record<string, ProfileRecord | null | undefined>;
  adminId?: string;
  adminEmail?: string;
  onSaved?: (request: RequestRecord, update: RequestUpdateRecord) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && adminId) {
    return (
      <ReportSickFollowupForm
        request={request}
        initialUpdate={followup}
        editMode="admin"
        actorId={adminId}
        actorEmail={adminEmail}
        onClose={() => setEditing(false)}
        onSaved={(updatedRequest, updatedFollowup) => {
          setEditing(false);
          onSaved?.(updatedRequest, updatedFollowup);
        }}
      />
    );
  }

  return (
    <div className="grid gap-3">
      {adminId ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>Edit post-visit details</Button>
        </div>
      ) : null}
      <ReportSickFollowupCard
        request={request}
        followup={followup}
        profilesById={profilesById}
        idPrefix="admin-report-sick-followup"
      />
    </div>
  );
}
