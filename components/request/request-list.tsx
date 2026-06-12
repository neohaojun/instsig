import Link from "next/link";
import { format } from "date-fns";
import type { ProfileRecord, RequestRecord } from "@/lib/types";
import { requestKindLabels } from "@/lib/request-meta";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/request/status-pill";
import { Badge } from "@/components/ui/badge";
import { formatProfileName } from "@/lib/profile-display";

export function RequestList({
  requests,
  getHref,
  profilesById = {},
}: {
  requests: RequestRecord[];
  getHref?: (request: RequestRecord) => string;
  profilesById?: Record<string, ProfileRecord | null | undefined>;
}) {
  if (!requests.length) {
    return (
      <Card className="overflow-hidden animate-enter-soft">
        <CardHeader className="space-y-2 p-8">
          <CardTitle className="text-3xl">No requests yet</CardTitle>
          <CardDescription>Start with a sick report or an external appointment request.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden animate-enter-soft">
      <CardHeader className="space-y-2 p-8">
        <CardTitle className="text-3xl">Recent requests</CardTitle>
        <CardDescription>Track status updates and open requests for review.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 p-8 pt-0">
        {requests.map((request, index) => {
          const requester = profilesById[request.requester_id];
          const submittedLabel = format(new Date(request.created_at), "dd MMM yyyy, HH:mm");

          return (
            <Link key={request.id} href={(getHref?.(request) ?? `/requests/${request.kind}?id=${request.id}`) as never} className="block">
              <div
                className={`group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05] ${
                  index === 0 ? "animate-enter-soft animate-delay-1" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 text-left">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-zinc-100">
                        {formatProfileName(requester, request.requester_email)}
                      </p>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-zinc-300">
                        {requestKindLabels[request.kind]}
                      </Badge>
                    </div>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{submittedLabel}</p>
                    <p className="max-w-[36rem] text-sm text-zinc-400">
                      {request.review_note ? request.review_note : "No admin note yet."}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={request.status} />
                    <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-zinc-200">
                      {request.kind === "report_sick"
                        ? request.status === "approved"
                          ? "Continue"
                          : request.status === "submitted" || request.status === "finalized" || request.status === "rejected"
                            ? "View"
                            : "Open"
                        : request.status === "pending" || request.status === "needs_changes" || request.status === "draft"
                          ? "Open"
                          : "View"}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
