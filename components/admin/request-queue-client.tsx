"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { StatusPill } from "@/components/request/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDisplayDateTime } from "@/lib/display-date";
import { formatProfileName } from "@/lib/profile-display";
import { buildRequestCardLines, formatRequestRequesterDescription } from "@/lib/request-card-display";
import { requestKindLabels } from "@/lib/request-meta";
import type { BatchRecord, ProfileRecord, RequestRecord, RequestUpdateRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type RequestStatusView = "pending" | "all";

function isIncompleteRequest(request: RequestRecord) {
  return request.kind === "report_sick"
    ? request.status !== "finalized" && request.status !== "rejected" && request.status !== "draft"
    : request.status === "pending";
}

function getAdminActionLabel(request: RequestRecord) {
  if (request.status === "finalized" || request.status === "rejected") return null;
  if (request.status === "pending" || request.status === "needs_changes") return "Review needed";
  if (request.kind === "report_sick" && (request.status === "submitted" || request.followup_submitted_at)) return "Ready to endorse";
  return null;
}

function searchText(request: RequestRecord, requester: ProfileRecord | null | undefined) {
  const payload = request.payload as Record<string, unknown>;
  return [
    formatProfileName(requester, request.requester_email),
    requester?.email,
    requester?.rank,
    requester?.full_name,
    requester?.nr,
    requester?.sscc_batch,
    requester?.common_term_platoon,
    requester?.specialisation_phase_platoon,
    request.requester_email,
    requestKindLabels[request.kind],
    request.status,
    ...Object.values(payload).filter((value) => ["string", "number", "boolean"].includes(typeof value)),
  ].filter(Boolean).join(" ").toLowerCase();
}

export function RequestQueueClient({
  requests,
  profilesById,
  batchesById,
  followupsByRequestId,
  initialStatusView,
  initialSearchQuery,
}: {
  requests: RequestRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
  followupsByRequestId: Record<string, RequestUpdateRecord | null | undefined>;
  initialStatusView: RequestStatusView;
  initialSearchQuery: string;
}) {
  const [statusView, setStatusView] = useState<RequestStatusView>(initialStatusView);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const visibleRequests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return requests
      .filter((request) => statusView === "all" || isIncompleteRequest(request))
      .filter((request) => !normalizedQuery || searchText(request, profilesById[request.requester_id]).includes(normalizedQuery))
      .sort((first, second) => Number(Boolean(getAdminActionLabel(second))) - Number(Boolean(getAdminActionLabel(first))));
  }, [profilesById, requests, searchQuery, statusView]);

  function selectStatus(nextStatus: RequestStatusView) {
    setStatusView(nextStatus);
    const url = new URL(window.location.href);
    if (nextStatus === "all") url.searchParams.set("status", "all");
    else url.searchParams.delete("status");
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <div className="grid gap-6">
      <div className="w-fit max-w-full rounded-2xl border border-border bg-muted p-1">
        <div className="flex flex-wrap gap-2">
          {(["pending", "all"] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => selectStatus(view)}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium capitalize text-muted-foreground transition hover:bg-background hover:text-foreground",
                view === statusView && "bg-background text-foreground shadow-sm",
              )}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-w-full flex-1 animate-enter-soft md:min-w-96">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search users" className="pl-9 pr-10" />
        {searchQuery ? (
          <Button type="button" size="sm" variant="ghost" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 px-0" onClick={() => setSearchQuery("")} aria-label="Clear request search">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <section key={statusView} className="grid gap-4 animate-enter-soft">
        <div className={cn("grid gap-3", statusView === "pending" ? "grid-cols-1" : "md:grid-cols-2 xl:grid-cols-3")}>
          {visibleRequests.length ? visibleRequests.map((request, index) => {
            const requester = profilesById[request.requester_id];
            const requesterBatch = requester?.batch_id ? batchesById[requester.batch_id] : null;
            const actionLabel = getAdminActionLabel(request);
            return (
              <Link key={request.id} href={`/admin/requests/${request.id}`} className="block w-full text-left">
                <div className={cn("group h-full rounded-2xl border border-border bg-card p-4 transition hover:bg-accent/50", index === 0 && "animate-enter-soft animate-delay-1", actionLabel && "border-foreground/20 bg-muted/50 shadow-sm ring-1 ring-foreground/10")}>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-card-foreground">
                        {actionLabel ? <span className="shrink-0 text-[15px] leading-none" aria-label={actionLabel}>⚠️</span> : null}
                        <span className="truncate">{formatProfileName(requester, request.requester_email)}</span>
                      </p>
                      <StatusPill status={request.status} />
                    </div>
                    <p className="text-sm leading-5 text-muted-foreground">{formatRequestRequesterDescription(request, requester, requesterBatch)}</p>
                    <div className="space-y-1 pt-2 text-sm leading-5 text-foreground">
                      {buildRequestCardLines(request, followupsByRequestId[request.id]).map((field) => <p key={field.label}><span className="font-medium">{field.label}:</span> {field.value}</p>)}
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">Submitted {formatDisplayDateTime(request.submitted_at ?? request.created_at)}</p>
                  </div>
                </div>
              </Link>
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              {statusView === "pending" ? "No pending requests found." : "None found."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
