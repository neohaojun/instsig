"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RequestRecord, RequestStatus, RequestUpdateRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusPill } from "@/components/request/status-pill";

export function AdminReviewPanel({
  request,
  followup,
  adminId,
  adminEmail,
}: {
  request: RequestRecord;
  followup?: RequestUpdateRecord | null;
  adminId: string;
  adminEmail: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<RequestStatus>(request.status);
  const [reviewNote, setReviewNote] = useState(request.review_note ?? "");
  const [suggestedPayload, setSuggestedPayload] = useState(JSON.stringify(request.payload, null, 2));
  const [message, setMessage] = useState<string | null>(null);
  type AdminAction = "approve" | "reject" | "suggest" | "finalize";
  const availableActions = useMemo<AdminAction[]>(() => {
    if (request.kind === "report_sick") {
      if (request.status === "approved" && !followup) return [];
      if (request.status === "approved" || request.status === "submitted") return ["finalize", "suggest", "reject"];
      if (request.status === "finalized" || request.status === "rejected") return [];
      return ["approve", "suggest", "reject"];
    }

    if (request.status === "approved" || request.status === "rejected") return [];
    return ["approve", "suggest", "reject"];
  }, [followup, request.kind, request.status]);
  const [action, setAction] = useState<AdminAction>(availableActions[0] ?? "approve");

  useEffect(() => {
    setAction(availableActions[0] ?? "approve");
  }, [availableActions]);

  function save(actionType: typeof action) {
    setMessage(null);
    startTransition(async () => {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        review_note: reviewNote || null,
      };

      if (actionType === "approve") {
        updates.status = "approved";
        updates.approved_by = adminId;
        updates.approved_at = new Date().toISOString();
      }

      if (actionType === "reject") {
        updates.status = "rejected";
        updates.rejected_by = adminId;
        updates.rejected_at = new Date().toISOString();
      }

      if (actionType === "finalize") {
        updates.status = "finalized";
        updates.finalized_by = adminId;
        updates.finalized_at = new Date().toISOString();
      }

      if (actionType === "suggest") {
        updates.status = "needs_changes";
        try {
          updates.suggested_payload = JSON.parse(suggestedPayload);
        } catch {
          setMessage("Suggested payload must be valid JSON.");
          return;
        }
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
            : actionType === "finalize"
              ? "finalize"
              : "suggest_edits";

      await supabase.from("request_events").insert({
        request_id: request.id,
        actor_id: adminId,
        actor_email: adminEmail,
        action: eventAction,
        note: reviewNote || null,
        changes: actionType === "suggest" ? updates.suggested_payload ?? null : null,
      });

      setStatus((updates.status as RequestStatus) ?? status);
      setMessage("Request updated.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          Admin review
          <StatusPill status={status} />
        </CardTitle>
        <CardDescription>
          {request.kind === "report_sick" && status === "approved" && !followup
            ? "Waiting for the requester to submit the doctor follow-up."
            : request.kind === "report_sick" && status === "approved" && followup
              ? "The requester has submitted the doctor follow-up. You can finalize the request."
            : "Approve, suggest edits, reject, or finalize the request."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2">
          <Label>Review note</Label>
          <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Add instructions for the requester" />
        </div>
        {availableActions.length ? (
          <>
            <div className="grid gap-2">
              <Label>Suggested payload JSON</Label>
              <Textarea value={suggestedPayload} onChange={(e) => setSuggestedPayload(e.target.value)} className="font-mono text-xs" rows={10} />
            </div>
            <div className="grid gap-2">
              <Label>Action</Label>
              <Select value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
                {availableActions.includes("approve") ? <option value="approve">Approve</option> : null}
                {availableActions.includes("suggest") ? <option value="suggest">Suggest edits</option> : null}
                {availableActions.includes("reject") ? <option value="reject">Reject</option> : null}
                {availableActions.includes("finalize") ? <option value="finalize">Finalize</option> : null}
              </Select>
            </div>
            {message ? <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">{message}</p> : null}
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setReviewNote("")}>
                Clear note
              </Button>
              <Button type="button" disabled={pending} onClick={() => save(action)}>
                {pending ? "Saving..." : "Apply action"}
              </Button>
            </div>
          </>
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
            {request.kind === "report_sick" && status === "approved" && !followup
              ? "No admin action is needed yet. The requester must submit the follow-up details before finalization."
              : request.kind === "report_sick" && status === "approved" && followup
                ? "The follow-up has been received. Finalize the request when you're ready."
              : "This request is already closed."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
