"use client";

import { useMemo, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RequestRecord, RequestStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusPill } from "@/components/request/status-pill";

export function AdminReviewPanel({
  request,
  adminId,
  adminEmail,
}: {
  request: RequestRecord;
  adminId: string;
  adminEmail: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<RequestStatus>(request.status);
  const [message, setMessage] = useState<string | null>(null);
  const availableActions = useMemo(() => {
    if (request.status === "approved" || request.status === "rejected" || request.status === "finalized") {
      return [];
    }

    return ["approve", "reject"] as const;
  }, [request.status]);

  function save(actionType: "approve" | "reject") {
    setMessage(null);
    startTransition(async () => {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
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
        note: null,
        changes: null,
      });

      setStatus((updates.status as RequestStatus) ?? status);
      setMessage("Request updated.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          Decision
          <StatusPill status={status} />
        </CardTitle>
        <CardDescription>
          Approve or reject this request.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {availableActions.length ? (
          <div className="grid gap-3">
            {message ? <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">{message}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={pending} onClick={() => save("approve")}>
                {pending ? "Saving..." : "Approve"}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => save("reject")}>
                Reject
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
            This request is already closed.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
