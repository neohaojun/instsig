import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/request/status-pill";
import type { ProfileRecord, RequestRecord } from "@/lib/types";
import { formatProfileName } from "@/lib/profile-display";
import { cn } from "@/lib/utils";
import { formatDisplayDateTime } from "@/lib/display-date";

type RequestStatusView = "pending" | "all";
type RequestKindView = "all" | "report_sick" | "external_appointment";

const statusViews: { value: RequestStatusView; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "all", label: "All" },
];

const kindViews: { value: RequestKindView; label: string }[] = [
  { value: "all", label: "All Requests" },
  { value: "report_sick", label: "Report Sick" },
  { value: "external_appointment", label: "External Appointment" },
];

function isIncompleteRequest(request: RequestRecord) {
  if (request.kind === "report_sick") {
    return request.status !== "finalized" && request.status !== "rejected" && request.status !== "draft";
  }

  return request.status !== "approved" && request.status !== "rejected" && request.status !== "draft";
}

function formatPendingRequestWhen(request: RequestRecord) {
  const payload = request.payload as Record<string, unknown>;

  if (request.kind === "report_sick") {
    const dateReportingSick = typeof payload.dateReportingSick === "string" ? payload.dateReportingSick : null;
    const timeReportingSick = typeof payload.timeReportingSick === "string" ? payload.timeReportingSick : null;

    if (dateReportingSick && timeReportingSick) {
      try {
        return `${format(parseISO(dateReportingSick), "dd/MM/yyyy")}, ${timeReportingSick}`;
      } catch {
        return `${dateReportingSick}, ${timeReportingSick}`;
      }
    }

    return "Date not set";
  }

  const when = typeof payload.when === "string" ? payload.when : null;
  if (!when) return "Date not set";

  try {
    return formatDisplayDateTime(parseISO(when), "Date not set");
  } catch {
    return when;
  }
}

function buildProfilesMap(profiles: ProfileRecord[] | null | undefined) {
  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
}

function getAdminActionLabel(request: RequestRecord) {
  if (request.status === "finalized" || request.status === "rejected") return null;
  if (request.status === "pending" || request.status === "needs_changes") return "Review needed";
  if (request.kind === "report_sick" && (request.status === "submitted" || request.followup_submitted_at)) return "Ready to endorse";
  return null;
}

function sortActionableRequests(requests: RequestRecord[]) {
  return [...requests].sort((first, second) => {
    const firstActionable = getAdminActionLabel(first) ? 1 : 0;
    const secondActionable = getAdminActionLabel(second) ? 1 : 0;
    return secondActionable - firstActionable;
  });
}

function filterRequestsByView(requests: RequestRecord[], statusView: RequestStatusView) {
  if (statusView === "all") return requests;
  return requests.filter(isIncompleteRequest);
}

function filterRequestsByKind(requests: RequestRecord[], kindView: RequestKindView) {
  if (kindView === "all") return requests;
  return requests.filter((request) => request.kind === kindView);
}

function resolveStatusView(status: string | string[] | undefined): RequestStatusView {
  const value = Array.isArray(status) ? status[0] : status;
  return statusViews.some((view) => view.value === value) ? (value as RequestStatusView) : "pending";
}

function resolveKindView(kind: string | string[] | undefined): RequestKindView {
  const value = Array.isArray(kind) ? kind[0] : kind;
  return kindViews.some((view) => view.value === value) ? (value as RequestKindView) : "all";
}

function RequestStatusTabs({ activeView, kindView }: { activeView: RequestStatusView; kindView: RequestKindView }) {
  return (
    <div className="w-fit max-w-full rounded-2xl border border-border bg-muted p-1">
      <div className="flex flex-wrap gap-2">
        {statusViews.map((view) => {
          const isActive = view.value === activeView;
          const query = {
            ...(view.value === "all" ? { status: view.value } : {}),
            ...(kindView === "all" ? {} : { kind: kindView }),
          };
          const href = Object.keys(query).length ? { pathname: "/admin/requests", query } : { pathname: "/admin/requests" };

          return (
            <Link
              key={view.value}
              href={href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-background hover:text-foreground",
                isActive && "bg-background text-foreground shadow-sm",
              )}
            >
              {view.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function RequestKindTabs({ activeView, statusView }: { activeView: RequestKindView; statusView: RequestStatusView }) {
  return (
    <div className="w-fit max-w-full rounded-2xl border border-border bg-muted p-1">
      <div className="flex flex-wrap gap-2">
        {kindViews.map((view) => {
          const isActive = view.value === activeView;
          const query = {
            ...(statusView === "all" ? { status: statusView } : {}),
            ...(view.value === "all" ? {} : { kind: view.value }),
          };
          const href = Object.keys(query).length ? { pathname: "/admin/requests", query } : { pathname: "/admin/requests" };

          return (
            <Link
              key={view.value}
              href={href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-background hover:text-foreground",
                isActive && "bg-background text-foreground shadow-sm",
              )}
            >
              {view.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function RequestsByKindCard({
  title,
  requests,
  profilesById,
  statusView,
}: {
  title: string;
  requests: RequestRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
  statusView: RequestStatusView;
}) {
  const emptyLabel =
    statusView === "pending"
      ? `No pending ${title.toLowerCase()} requests right now.`
      : `No ${title.toLowerCase()} requests found for this view.`;

  return (
    <Card className="overflow-hidden animate-enter-soft">
      <CardHeader className="space-y-4 p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-3xl">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {requests.length} {requests.length === 1 ? "request" : "requests"}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-8 pt-0">
        {requests.length ? (
          sortActionableRequests(requests).map((request, index) => {
            const requester = profilesById[request.requester_id];
            const actionLabel = getAdminActionLabel(request);

            return (
              <Link key={request.id} href={`/admin/requests/${request.id}`} className="block">
                <div
                  className={cn(
                    "group rounded-2xl border border-border bg-card p-4 transition hover:bg-accent/50",
                    index === 0 && "animate-enter-soft animate-delay-1",
                    actionLabel && "border-foreground/20 bg-muted/50 shadow-sm ring-1 ring-foreground/10",
                  )}
                >
                  <div className="flex items-center justify-between gap-4 text-left">
                    <div className="min-w-0 space-y-2">
                      {actionLabel ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">{actionLabel}</p> : null}
                      <p className="truncate text-sm font-medium text-card-foreground">
                        {formatProfileName(requester, request.requester_email)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPendingRequestWhen(request)}
                      </p>
                    </div>
                    <StatusPill status={request.status} />
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; kind?: string | string[] }>;
}) {
  const { status, kind } = await searchParams;
  const statusView = resolveStatusView(status);
  const kindView = resolveKindView(kind);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: requests } = await supabase.from("requests").select("*").order("created_at", { ascending: false });
  const visibleRequests = filterRequestsByKind(filterRequestsByView(requests ?? [], statusView), kindView);
  const reportSickRequests = visibleRequests.filter((request) => request.kind === "report_sick");
  const externalAppointmentRequests = visibleRequests.filter((request) => request.kind === "external_appointment");

  const requesterIds = Array.from(new Set(visibleRequests.map((request) => request.requester_id)));
  const { data: requesters } = requesterIds.length
    ? await supabase.from("profiles").select("*").in("id", requesterIds)
    : { data: [] as ProfileRecord[] };
  const requestersById = buildProfilesMap(requesters);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-8">
            <div className="space-y-2">
              <CardTitle className="text-3xl">Request Queue</CardTitle>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/">Back to dashboard</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="flex flex-wrap gap-3">
          <RequestStatusTabs activeView={statusView} kindView={kindView} />
          <RequestKindTabs activeView={kindView} statusView={statusView} />
        </div>

        {kindView === "all" || kindView === "report_sick" ? (
          <RequestsByKindCard
            title="Report Sick"
            requests={reportSickRequests}
            profilesById={requestersById}
            statusView={statusView}
          />
        ) : null}
        {kindView === "all" || kindView === "external_appointment" ? (
          <RequestsByKindCard
            title="External Appointment"
            requests={externalAppointmentRequests}
            profilesById={requestersById}
            statusView={statusView}
          />
        ) : null}
      </section>
    </main>
  );
}
