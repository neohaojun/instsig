import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { StrengthCard } from "@/components/dashboard/strength-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CalendarClock } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { ProfileRecord, RequestRecord, RequestUpdateRecord } from "@/lib/types";
import { requestKindLabels } from "@/lib/request-meta";
import { formatProfileName } from "@/lib/profile-display";
import { StatusPill } from "@/components/request/status-pill";
import { formatDisplayDateTime } from "@/lib/display-date";
import { buildStrengthSummary } from "@/lib/strength-summary";
import { cn } from "@/lib/utils";

function isIncompleteRequest(request: RequestRecord) {
  if (request.kind === "report_sick") {
    return request.status !== "finalized" && request.status !== "rejected" && request.status !== "draft";
  }

  return request.status !== "approved" && request.status !== "rejected" && request.status !== "draft";
}

function formatReportedAt(request: RequestRecord) {
  const payload = request.payload as Record<string, unknown>;
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

function formatRequestWhen(request: RequestRecord) {
  if (request.kind === "report_sick") {
    return formatReportedAt(request);
  }

  const payload = request.payload as Record<string, unknown>;
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

const requestPathByKind = {
  report_sick: "/requests/report-sick",
  external_appointment: "/requests/external-appointment",
} as const;

const adminRequestPathByKind = {
  report_sick: "/admin/requests?kind=report_sick",
  external_appointment: "/admin/requests?kind=external_appointment",
} as const;

function RequestSubcard({
  href,
  title,
  meta,
  description,
  showAdminAction = false,
  request,
}: {
  href: string;
  title: string;
  meta: string;
  description?: string;
  showAdminAction?: boolean;
  request: RequestRecord;
}) {
  const actionLabel = showAdminAction ? getAdminActionLabel(request) : null;

  return (
    <Link href={href as never} className="block">
      <div
        className={cn(
          "group rounded-2xl border border-border bg-card p-4 transition hover:bg-accent/50",
          actionLabel && "border-foreground/20 bg-muted/50 shadow-sm ring-1 ring-foreground/10",
        )}
      >
        <div className="flex items-center justify-between gap-4 text-left">
          <div className="min-w-0 space-y-2">
            {actionLabel ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">{actionLabel}</p> : null}
            <p className="truncate text-sm font-medium text-card-foreground">{title}</p>
            {description ? <p className="max-w-[36rem] text-sm text-muted-foreground">{description}</p> : null}
            <p className="text-xs text-muted-foreground">{meta}</p>
          </div>
          <StatusPill status={request.status} />
        </div>
      </div>
    </Link>
  );
}

function AdminPendingRequestsCard({
  title,
  requests,
  requestersById,
  viewAllHref,
}: {
  title: string;
  requests: RequestRecord[];
  requestersById: Record<string, ProfileRecord | null | undefined>;
  viewAllHref: string;
}) {
  return (
    <Card className="overflow-hidden animate-enter-soft animate-delay-2">
      <CardHeader className="space-y-4 p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-3xl">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {requests.length} pending {requests.length === 1 ? "request" : "requests"}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-8 pt-0">
        {requests.length ? (
          sortActionableRequests(requests).slice(0, 2).map((request) => {
            const requester = requestersById[request.requester_id];

            return (
              <RequestSubcard
                key={request.id}
                href={`/admin/requests/${request.id}`}
                title={formatProfileName(requester, request.requester_email)}
                meta={formatRequestWhen(request)}
                showAdminAction
                request={request}
              />
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            No pending {title.toLowerCase()} requests right now.
          </div>
        )}
        <div className="pt-2">
          <Button asChild variant="link" className="h-auto px-0">
            <Link href={viewAllHref as never}>View all</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const [{ data: allRequests }] = await Promise.all([
    supabase.from("requests").select("*").order("updated_at", { ascending: false }).order("created_at", { ascending: false }),
  ]);

  const requests = (allRequests ?? []) as RequestRecord[];
  const reportSickRequestIds = requests.filter((request) => request.kind === "report_sick").map((request) => request.id);
  const { data: requestUpdates } = reportSickRequestIds.length
    ? await supabase.from("request_updates").select("*").in("request_id", reportSickRequestIds).order("created_at", { ascending: true })
    : { data: [] as RequestUpdateRecord[] };
  const pendingRequests = requests.filter(isIncompleteRequest);
  const requestHistory = requests.filter((request) => request.requester_id === user.id && request.status !== "draft");
  const recentRequestHistory = requestHistory.slice(0, 2);
  const isAdmin = profile?.role === "admin";
  const { data: profilesForDashboard } = isAdmin
    ? await supabase.from("profiles").select("*")
    : pendingRequests.length
      ? await supabase.from("profiles").select("*").in("id", pendingRequests.map((request) => request.requester_id))
      : { data: [] as ProfileRecord[] };
  const profileRecords = (profilesForDashboard ?? []) as ProfileRecord[];
  const requestersById = buildProfilesMap(profileRecords);
  const strengthSummary = buildStrengthSummary(profileRecords, requests, (requestUpdates ?? []) as RequestUpdateRecord[]);
  const reportSickPendingRequests = pendingRequests.filter((request) => request.kind === "report_sick");
  const externalAppointmentPendingRequests = pendingRequests.filter((request) => request.kind === "external_appointment");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopBar role={isAdmin ? "admin" : "user"} userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-8">
            <div className="space-y-2">
              <CardTitle className="text-3xl">{isAdmin ? "Admin Dashboard" : "Dashboard"}</CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card className="overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-8">
            <div className="space-y-2">
              <CardTitle className="text-3xl">New Requests</CardTitle>
            </div>
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <Button asChild size="lg" className="h-auto justify-start gap-4 py-6 text-left">
                <Link href="/requests/report-sick">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-foreground/15 text-primary-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Report Sick</p>
                  </div>
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-auto justify-start gap-4 py-6 text-left">
                <Link href="/requests/external-appointment">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-secondary text-secondary-foreground">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">External Appointment</p>
                  </div>
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        {recentRequestHistory.length ? (
          <Card className="overflow-hidden animate-enter-soft animate-delay-1">
            <CardHeader className="space-y-4 p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <CardTitle className="text-3xl">Request History</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 p-8 pt-0">
              {recentRequestHistory.map((request) => (
                <RequestSubcard
                  key={request.id}
                  href={`${requestPathByKind[request.kind]}?id=${request.id}`}
                  title={requestKindLabels[request.kind]}
                  meta={formatRequestWhen(request)}
                  request={request}
                />
              ))}
              <div className="pt-2">
                <Button asChild variant="link" className="h-auto px-0">
                  <Link href="/history">View all</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isAdmin ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <AdminPendingRequestsCard
              title="Report Sick"
              requests={reportSickPendingRequests}
              requestersById={requestersById}
              viewAllHref={adminRequestPathByKind.report_sick}
            />
            <AdminPendingRequestsCard
              title="External Appointment"
              requests={externalAppointmentPendingRequests}
              requestersById={requestersById}
              viewAllHref={adminRequestPathByKind.external_appointment}
            />
          </div>
        ) : null}

        {isAdmin ? <StrengthCard summary={strengthSummary} href="/dashboard/strength" /> : null}
      </section>
    </main>
  );
}
