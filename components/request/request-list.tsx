import Link from "next/link";
import { format } from "date-fns";
import type { ProfileRecord, RequestRecord } from "@/lib/types";
import { requestKindLabels } from "@/lib/request-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/request/status-pill";
import { Badge } from "@/components/ui/badge";
import { formatProfileName } from "@/lib/profile-display";

const requestPathByKind = {
  report_sick: "/requests/report-sick",
  external_appointment: "/requests/external-appointment",
} as const;

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
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden animate-enter-soft">
      <CardHeader className="space-y-2 p-8">
        <CardTitle className="text-3xl">Recent requests</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-8 pt-0">
        {requests.map((request, index) => {
          const requester = profilesById[request.requester_id];
          const submittedLabel = format(new Date(request.created_at), "dd MMM yyyy, HH:mm");
          const href = getHref?.(request) ?? `${requestPathByKind[request.kind]}?id=${request.id}`;

          return (
            <Link key={request.id} href={href as never} className="block">
              <div
                className={`group rounded-2xl border border-border bg-card p-4 transition hover:bg-accent/50 ${
                  index === 0 ? "animate-enter-soft animate-delay-1" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 text-left">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-card-foreground">
                        {formatProfileName(requester, request.requester_email)}
                      </p>
                      <Badge variant="outline">
                        {requestKindLabels[request.kind]}
                      </Badge>
                    </div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{submittedLabel}</p>
                    {request.review_note ? <p className="max-w-[36rem] text-sm text-muted-foreground">{request.review_note}</p> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={request.status} />
                    <div className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                      {request.kind === "report_sick"
                        ? request.followup_submitted_at
                          ? "View"
                          : request.status === "approved"
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
