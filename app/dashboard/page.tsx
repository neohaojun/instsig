import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { StrengthCard } from "@/components/dashboard/strength-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CalendarClock } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { BatchRecord, ProfileRecord, RequestRecord, RequestUpdateRecord, StrengthManualRecord } from "@/lib/types";
import { formatProfileName } from "@/lib/profile-display";
import { StatusPill } from "@/components/request/status-pill";
import { formatDisplayDateTime } from "@/lib/display-date";
import { buildStrengthSummary } from "@/lib/strength-summary";
import { cn } from "@/lib/utils";
import { formatRequestRequesterDescription } from "@/lib/request-card-display";

function isIncompleteRequest(request: RequestRecord) {
  if (request.kind === "report_sick") {
    return request.status !== "finalized" && request.status !== "rejected" && request.status !== "draft";
  }

  return request.status !== "approved" && request.status !== "rejected" && request.status !== "draft";
}

function isAwaitingDashboardAction(request: RequestRecord) {
  if (request.kind === "report_sick") {
    return request.status === "pending" || request.status === "submitted";
  }

  return request.status === "pending";
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
          "group rounded-2xl border border-border bg-card p-3 transition hover:bg-accent/50",
          actionLabel && "border-foreground/20 bg-muted/50 shadow-sm ring-1 ring-foreground/10",
        )}
      >
        <div className="flex items-center justify-between gap-4 text-left">
          <div className="min-w-0 space-y-1">
            <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-card-foreground">
              {actionLabel ? (
                <span className="shrink-0 text-[15px] leading-none" aria-label={actionLabel}>
                  <span aria-hidden="true">⚠️</span>
                  <span className="sr-only">{actionLabel}</span>
                </span>
              ) : null}
              <span className="truncate">{title}</span>
            </p>
            {description ? <p className="max-w-[36rem] text-sm leading-5 text-muted-foreground">{description}</p> : null}
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
  batchesById,
  viewAllHref,
}: {
  title: string;
  requests: RequestRecord[];
  requestersById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
  viewAllHref: string;
}) {
  return (
    <Card className="overflow-hidden animate-enter-soft animate-delay-2">
      <CardHeader className="space-y-4 p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-3xl">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {requests.length} awaiting action
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-8 pt-0">
        {requests.length ? (
          sortActionableRequests(requests).slice(0, 2).map((request) => {
            const requester = requestersById[request.requester_id];
            const requesterBatch = requester?.batch_id ? batchesById[requester.batch_id] : null;

            return (
              <RequestSubcard
                key={request.id}
                href={`/admin/requests/${request.id}`}
                title={formatProfileName(requester, request.requester_email)}
                description={formatRequestRequesterDescription(request, requester, requesterBatch)}
                meta={formatRequestWhen(request)}
                showAdminAction
                request={request}
              />
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            None found.
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

function UserHistoryCard({
  title,
  requests,
  kind,
}: {
  title: string;
  requests: RequestRecord[];
  kind: keyof typeof requestPathByKind;
}) {
  const visibleRequests = requests.filter((request) => request.kind === kind).slice(0, 2);

  return (
    <Card className="overflow-hidden animate-enter-soft animate-delay-1">
      <CardHeader className="space-y-4 p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-3xl">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-8 pt-0">
        {visibleRequests.length ? (
          visibleRequests.map((request) => (
            <RequestSubcard
              key={request.id}
              href={`${requestPathByKind[request.kind]}?id=${request.id}`}
              title={formatRequestWhen(request)}
              meta={`Submitted ${formatDisplayDateTime(request.submitted_at ?? request.created_at)}`}
              request={request}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            None found.
          </div>
        )}
        <div className="pt-2">
          <Button asChild variant="link" className="h-auto px-0">
            <Link href="/history">View all</Link>
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
  const [{ data: allRequests }, { data: batches }] = await Promise.all([
    supabase.from("requests").select("*").order("updated_at", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("batches").select("*"),
  ]);

  const requests = (allRequests ?? []) as RequestRecord[];
  const reportSickRequestIds = requests.filter((request) => request.kind === "report_sick").map((request) => request.id);
  const { data: requestUpdates } = reportSickRequestIds.length
    ? await supabase.from("request_updates").select("*").in("request_id", reportSickRequestIds).order("created_at", { ascending: true })
    : { data: [] as RequestUpdateRecord[] };
  const pendingRequests = requests.filter(isIncompleteRequest);
  const requestHistory = requests.filter((request) => request.requester_id === user.id && request.status !== "draft");
  const isAdmin = profile?.role === "admin";
  const { data: strengthRecords } = isAdmin
    ? await supabase.from("strength_records").select("*").order("duty_date", { ascending: false }).order("created_at", { ascending: false })
    : { data: [] as StrengthManualRecord[] };
  const { data: profilesForDashboard } = isAdmin
    ? await supabase.from("profiles").select("*")
    : pendingRequests.length
      ? await supabase.from("profiles").select("*").in("id", pendingRequests.map((request) => request.requester_id))
      : { data: [] as ProfileRecord[] };
  const profileRecords = (profilesForDashboard ?? []) as ProfileRecord[];
  const requestersById = buildProfilesMap(profileRecords);
  const batchesById = Object.fromEntries(((batches ?? []) as BatchRecord[]).map((batch) => [batch.id, batch]));
  const strengthSummary = buildStrengthSummary(
    profileRecords,
    requests,
    (requestUpdates ?? []) as RequestUpdateRecord[],
    batchesById,
    (strengthRecords ?? []) as StrengthManualRecord[],
  );
  const reportSickPendingRequests = requests.filter((request) => request.kind === "report_sick" && isAwaitingDashboardAction(request));
  const externalAppointmentPendingRequests = requests.filter((request) => request.kind === "external_appointment" && isAwaitingDashboardAction(request));

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

        {requestHistory.length ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <UserHistoryCard title="Report Sick History" requests={requestHistory} kind="report_sick" />
            <UserHistoryCard title="Ext Appt History" requests={requestHistory} kind="external_appointment" />
          </div>
        ) : null}

        {isAdmin ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <AdminPendingRequestsCard
              title="Report Sick Requests"
              requests={reportSickPendingRequests}
              requestersById={requestersById}
              batchesById={batchesById}
              viewAllHref={adminRequestPathByKind.report_sick}
            />
            <AdminPendingRequestsCard
              title="Ext Appt Requests"
              requests={externalAppointmentPendingRequests}
              requestersById={requestersById}
              batchesById={batchesById}
              viewAllHref={adminRequestPathByKind.external_appointment}
            />
          </div>
        ) : null}

        {isAdmin ? <StrengthCard summary={strengthSummary} href="/dashboard/strength" /> : null}
      </section>
    </main>
  );
}
