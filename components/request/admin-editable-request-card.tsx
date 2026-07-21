"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileRecord, RequestRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ExternalAppointmentRequestCard } from "@/components/request/external-appointment-card";
import { ReportSickInitialRequestCard } from "@/components/request/report-sick-followup-form";
import { RequestForm } from "@/components/request/request-form";

export function AdminEditableRequestCard({
  request,
  profilesById,
  adminId,
  adminEmail,
}: {
  request: RequestRecord;
  profilesById: Record<string, ProfileRecord | null | undefined>;
  adminId: string;
  adminEmail: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <RequestForm
        kind={request.kind}
        userEmail={request.requester_email}
        userId={request.requester_id}
        initialRequest={request}
        requestId={request.id}
        editMode="admin"
        actorId={adminId}
        actorEmail={adminEmail}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => setEditing(true)}>
          Edit request
        </Button>
      </div>
      {request.kind === "report_sick" ? (
        <ReportSickInitialRequestCard request={request} profilesById={profilesById} />
      ) : (
        <ExternalAppointmentRequestCard request={request} profilesById={profilesById} />
      )}
    </div>
  );
}
