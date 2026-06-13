"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RequestRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AdminReviewPanel({
  request,
  adminId,
  adminEmail,
  hasFollowup,
}: {
  request: RequestRecord;
  adminId: string;
  adminEmail: string;
  hasFollowup?: boolean;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const hasSubmittedFollowup = request.kind === "report_sick" && (Boolean(request.followup_submitted_at) || Boolean(hasFollowup));
  const isFinalized = Boolean(request.finalized_at) || request.status === "finalized";
  const isRejected = Boolean(request.rejected_at) || request.status === "rejected";
  const isApproved = Boolean(request.approved_at) || request.status === "approved" || request.status === "submitted";

  function save(actionType: "approve" | "reject" | "finalize") {
    if (pending) return;

    setMessage(null);
    startTransition(async () => {
      const timestamp = new Date().toISOString();
      const updates: Record<string, unknown> = {
        updated_at: timestamp,
      };

      if (actionType === "approve") {
        updates.status = "approved";
        updates.approved_by = adminId;
        updates.approved_at = timestamp;
      }

      if (actionType === "reject") {
        updates.status = "rejected";
        updates.rejected_by = adminId;
        updates.rejected_at = timestamp;
      }

      if (actionType === "finalize") {
        updates.status = "finalized";
        updates.finalized_by = adminId;
        updates.finalized_at = timestamp;
      }

      const { error } = await supabase.from("requests").update(updates).eq("id", request.id);
      if (error) {
        setMessage("We couldn't update this request right now. Please try again.");
        return;
      }

      const eventAction =
        actionType === "approve"
          ? "approve"
          : actionType === "reject"
            ? "reject"
            : "finalize";

      await supabase.from("request_events").insert({
        request_id: request.id,
        actor_id: adminId,
        actor_email: adminEmail,
        action: eventAction,
        note: null,
        changes: null,
      });

      router.refresh();
      router.back();
    });
  }

  const canReview = !isApproved && !isRejected && !isFinalized;
  const canFinalize = request.kind === "report_sick" && !isRejected && !isFinalized && hasSubmittedFollowup;
  const isWaitingForFollowup = request.kind === "report_sick" && isApproved && !hasSubmittedFollowup && !isFinalized;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-6">
        {message ? <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">{message}</p> : null}
        {isWaitingForFollowup ? (
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Waiting for post-visit follow-up.
          </p>
        ) : null}
        {isFinalized ? (
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Finalized.
          </p>
        ) : null}
        {isRejected ? (
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Rejected.
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          {canReview ? (
            <>
              <Button type="button" disabled={pending} onClick={() => save("approve")} className="sm:flex-1">
                {pending ? "Saving..." : "Approve"}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => save("reject")} className="sm:flex-1">
                Reject
              </Button>
            </>
          ) : null}
          {canFinalize ? (
            <Button type="button" disabled={pending} onClick={() => save("finalize")} className="sm:flex-1">
              {pending ? "Saving..." : "Finalize"}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => router.back()} className="sm:flex-1">
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
