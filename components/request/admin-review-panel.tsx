"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RequestRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function AdminReviewPanel({
  request,
  adminId,
  adminEmail,
  hasFollowup,
  onClose,
  onUpdated,
  onDeleted,
  showClose = true,
}: {
  request: RequestRecord;
  adminId: string;
  adminEmail: string;
  hasFollowup?: boolean;
  onClose?: () => void;
  onUpdated?: (request: RequestRecord) => void;
  onDeleted?: (requestId: string) => void;
  showClose?: boolean;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hasSubmittedFollowup = request.kind === "report_sick" && (Boolean(request.followup_submitted_at) || Boolean(hasFollowup));
  const isFinalized = Boolean(request.finalized_at) || request.status === "finalized";
  const isRejected = Boolean(request.rejected_at) || request.status === "rejected";
  const isApproved = Boolean(request.approved_at) || request.status === "approved" || request.status === "submitted";
  const canReject = request.kind === "report_sick";

  async function deleteRequest() {
    if (deleting) return;
    setDeleting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: request.id }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "This request could not be deleted.");
      setDeleteOpen(false);
      if (onDeleted) {
        onDeleted(request.id);
      } else {
        router.replace("/admin/requests");
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to delete request", error);
      setMessage(error instanceof Error ? error.message : "This request could not be deleted.");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

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

      const { data: updatedRequest, error } = await supabase.from("requests").update(updates).eq("id", request.id).select().single();
      if (error) {
        console.error("Failed to update admin request action", error);
        setMessage("We couldn't update this request right now. Please try again.");
        return;
      }

      const eventAction =
        actionType === "approve"
          ? "approve"
          : actionType === "reject"
            ? "reject"
            : "finalize";

      const { error: eventError } = await supabase.from("request_events").insert({
        request_id: request.id,
        actor_id: adminId,
        actor_email: adminEmail,
        action: eventAction,
        note: null,
        changes: null,
      });
      if (eventError) {
        console.error("Failed to record admin request event", eventError);
      }

      if (onUpdated) {
        onUpdated(updatedRequest as RequestRecord);
      } else {
        router.refresh();
      }

      if (onClose) {
        onClose();
      } else {
        router.back();
      }
    });
  }

  const canReview = !isApproved && !isRejected && !isFinalized;
  const canFinalize = request.kind === "report_sick" && !isRejected && !isFinalized && hasSubmittedFollowup;
  const showActionRow = canReview || canFinalize || showClose || Boolean(request.id);

  if (!showActionRow && !message) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-6">
        {message ? <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">{message}</p> : null}
        {showActionRow ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            {canReview ? (
              <>
                <Button type="button" disabled={pending} onClick={() => save("approve")} className="sm:flex-1">
                  {pending ? "Saving..." : "Approve"}
                </Button>
                {canReject ? (
                  <Button type="button" variant="outline" disabled={pending} onClick={() => save("reject")} className="sm:flex-1">
                    Reject
                  </Button>
                ) : null}
              </>
            ) : null}
            {canFinalize ? (
              <Button type="button" disabled={pending} onClick={() => save("finalize")} className="sm:flex-1">
                {pending ? "Saving..." : "Endorse"}
              </Button>
            ) : null}
            {showClose ? (
              <Button type="button" variant="outline" onClick={onClose ?? (() => router.back())} className="sm:flex-1">
                Back
              </Button>
            ) : null}
            <Button type="button" variant="destructive" disabled={pending || deleting} onClick={() => setDeleteOpen(true)} className="sm:flex-1">
              Delete request
            </Button>
          </div>
        ) : null}
      </CardContent>
      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open); }}>
        <DialogContent aria-labelledby="delete-request-title" className="max-w-md rounded-2xl">
          <div className="space-y-3 p-6">
            <h2 id="delete-request-title" className="text-lg font-semibold">Delete this request?</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              This permanently removes the request and all linked follow-up and audit records. This action cannot be undone.
            </p>
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button type="button" variant="destructive" disabled={deleting} onClick={() => void deleteRequest()}>
                {deleting ? "Deleting..." : "Delete request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
