"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, CalendarClock, ChevronLeft, FileText, Users } from "lucide-react";
import { TopBar } from "@/components/layout/topbar";
import { RequestForm } from "@/components/request/request-form";
import { StatusPill } from "@/components/request/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatProfileName } from "@/lib/profile-display";
import { requestKindLabels } from "@/lib/request-meta";
import type { ProfileRecord, RequestKind, RequestRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type ShellView = "dashboard" | "history" | "admin" | "adminRequests" | "newReportSick" | "newExternalAppointment";
type RequestStatusView = "pending" | "all";

const statusViews: { value: RequestStatusView; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "all", label: "All" },
];

const requestPathByKind = {
  report_sick: "/requests/report-sick",
  external_appointment: "/requests/external-appointment",
} as const;

function isIncompleteRequest(request: RequestRecord) {
  if (request.kind === "report_sick") {
    return request.status !== "finalized" && request.status !== "rejected" && request.status !== "draft";
  }

  return request.status !== "approved" && request.status !== "rejected" && request.status !== "draft";
}

function formatReportSickReportedAt(request: RequestRecord) {
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
  if (request.kind === "report_sick") return formatReportSickReportedAt(request);

  const payload = request.payload as Record<string, unknown>;
  const when = typeof payload.when === "string" ? payload.when : null;
  if (!when) return "Date not set";

  try {
    return format(parseISO(when), "dd/MM/yyyy, HH:mm");
  } catch {
    return when;
  }
}

function requestDetailHref(request: RequestRecord) {
  return `${requestPathByKind[request.kind]}?id=${request.id}`;
}

function RequestSubcard({
  href,
  title,
  meta,
  description,
  request,
}: {
  href: string;
  title: string;
  meta: string;
  description?: string;
  request: RequestRecord;
}) {
  return (
    <a href={href} className="block">
      <div className="group rounded-2xl border border-border bg-card p-4 transition hover:bg-accent/50">
        <div className="flex items-center justify-between gap-4 text-left">
          <div className="min-w-0 space-y-2">
            <p className="truncate text-sm font-medium text-card-foreground">{title}</p>
            {description ? <p className="max-w-[36rem] text-sm text-muted-foreground">{description}</p> : null}
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{meta}</p>
          </div>
          <StatusPill status={request.status} />
        </div>
      </div>
    </a>
  );
}

function DashboardView({
  requests,
  profile,
  userEmail,
  profilesById,
  onNavigate,
}: {
  requests: RequestRecord[];
  profile: ProfileRecord | null;
  userEmail: string | null;
  profilesById: Record<string, ProfileRecord | null | undefined>;
  onNavigate: (view: ShellView) => void;
}) {
  const isAdmin = profile?.role === "admin";
  const pendingRequests = requests.filter(isIncompleteRequest);
  const requestHistory = requests.filter((request) => request.requester_id === profile?.id && request.status !== "draft");
  const recentRequestHistory = requestHistory.slice(0, 2);
  const recentPendingRequests = pendingRequests.slice(0, 2);

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Card className="overflow-hidden animate-enter">
        <CardHeader className="space-y-4 p-8">
          <CardTitle className="text-3xl">Dashboard</CardTitle>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden animate-enter">
        <CardHeader className="space-y-4 p-8">
          <CardTitle className="text-3xl">New Requests</CardTitle>
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <Button type="button" size="lg" className="h-auto justify-start gap-4 py-6 text-left" onClick={() => onNavigate("newReportSick")}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-foreground/15 text-primary-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold">Report Sick</p>
              </div>
            </Button>
            <Button type="button" size="lg" variant="outline" className="h-auto justify-start gap-4 py-6 text-left" onClick={() => onNavigate("newExternalAppointment")}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-secondary text-secondary-foreground">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold">External Appointment</p>
              </div>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {recentRequestHistory.length ? (
        <Card className="overflow-hidden animate-enter-soft animate-delay-1">
          <CardHeader className="space-y-4 p-8">
            <CardTitle className="text-3xl">Request History</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-8 pt-0">
            {recentRequestHistory.map((request) => (
              <RequestSubcard
                key={request.id}
                href={requestDetailHref(request)}
                title={requestKindLabels[request.kind]}
                meta={formatRequestWhen(request)}
                request={request}
              />
            ))}
            <div className="pt-2">
              <Button type="button" variant="link" className="h-auto px-0" onClick={() => onNavigate("history")}>
                View all
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card className="overflow-hidden animate-enter-soft animate-delay-2">
          <CardHeader className="space-y-4 p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <CardTitle className="text-3xl">Pending Requests</CardTitle>
                <p className="text-sm text-muted-foreground">{pendingRequests.length} pending</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-8 pt-0">
            {recentPendingRequests.length ? (
              recentPendingRequests.map((request) => (
                <RequestSubcard
                  key={request.id}
                  href={`/admin/requests/${request.id}`}
                  title={formatProfileName(profilesById[request.requester_id], request.requester_email)}
                  meta={formatRequestWhen(request)}
                  description={requestKindLabels[request.kind]}
                  request={request}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                No pending requests right now.
              </div>
            )}
            <div className="pt-2">
              <Button type="button" variant="link" className="h-auto px-0" onClick={() => onNavigate("adminRequests")}>
                View all
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function HistoryView({
  requests,
  profile,
  onNavigate,
}: {
  requests: RequestRecord[];
  profile: ProfileRecord | null;
  onNavigate: (view: ShellView) => void;
}) {
  const userRequests = requests.filter((request) => request.requester_id === profile?.id && request.status !== "draft");
  const reportSickRequests = userRequests.filter((request) => request.kind === "report_sick");
  const externalAppointmentRequests = userRequests.filter((request) => request.kind === "external_appointment");

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Card className="overflow-hidden animate-enter">
        <CardHeader className="space-y-4 p-8">
          <CardTitle className="text-3xl">Request History</CardTitle>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => onNavigate("dashboard")}>
              <ChevronLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
          </div>
        </CardHeader>
      </Card>

      <HistoryCard title="Report Sick" requests={reportSickRequests} emptyText="None found." />
      <HistoryCard title="External Appointment" requests={externalAppointmentRequests} emptyText="None found." />
    </section>
  );
}

function HistoryCard({ title, requests, emptyText }: { title: string; requests: RequestRecord[]; emptyText: string }) {
  return (
    <Card className="overflow-hidden animate-enter">
      <CardHeader className="space-y-4 p-8">
        <CardTitle className="text-3xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-8 pt-0">
        {requests.length ? (
          requests.map((request, index) => (
            <a key={request.id} href={requestDetailHref(request)} className="block">
              <div
                className={cn(
                  "group rounded-2xl border border-border bg-card p-4 transition hover:bg-accent/50",
                  index === 0 && "animate-enter-soft animate-delay-1",
                )}
              >
                <div className="flex items-center justify-between gap-4 text-left">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-card-foreground">{requestKindLabels[request.kind]}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{formatRequestWhen(request)}</p>
                  </div>
                  <StatusPill status={request.status} />
                </div>
              </div>
            </a>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {emptyText}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminLandingView({ onNavigate }: { onNavigate: (view: ShellView) => void }) {
  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Card className="overflow-hidden animate-enter">
        <CardHeader className="space-y-4 p-6 sm:p-8">
          <Badge variant="outline" className="w-fit">
            Admin
          </Badge>
          <CardTitle className="text-3xl leading-tight sm:text-4xl">Choose a workspace</CardTitle>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <button type="button" onClick={() => onNavigate("adminRequests")} className="group block text-left">
          <Card className="h-full overflow-hidden transition hover:bg-accent/50 animate-enter-soft animate-delay-1">
            <CardHeader className="space-y-4 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-secondary text-secondary-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground transition group-hover:text-foreground" />
              </div>
              <CardTitle className="text-2xl">Request queue</CardTitle>
            </CardHeader>
          </Card>
        </button>

        <a href="/admin/users" className="group block">
          <Card className="h-full overflow-hidden transition hover:bg-accent/50 animate-enter-soft animate-delay-2">
            <CardHeader className="space-y-4 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-secondary text-secondary-foreground">
                  <Users className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground transition group-hover:text-foreground" />
              </div>
              <CardTitle className="text-2xl">User directory</CardTitle>
            </CardHeader>
          </Card>
        </a>
      </div>
    </section>
  );
}

function filterRequestsByView(requests: RequestRecord[], statusView: RequestStatusView) {
  if (statusView === "all") return requests;
  return requests.filter(isIncompleteRequest);
}

function RequestStatusTabs({ activeView, onChange }: { activeView: RequestStatusView; onChange: (view: RequestStatusView) => void }) {
  return (
    <div className="w-fit max-w-full rounded-2xl border border-border bg-muted p-1">
      <div className="flex flex-wrap gap-2">
        {statusViews.map((view) => {
          const isActive = view.value === activeView;

          return (
            <button
              key={view.value}
              type="button"
              onClick={() => onChange(view.value)}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-background hover:text-foreground",
                isActive && "bg-background text-foreground shadow-sm",
              )}
            >
              {view.label}
            </button>
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
          requests.map((request, index) => (
            <a key={request.id} href={`/admin/requests/${request.id}`} className="block">
              <div
                className={cn(
                  "group rounded-2xl border border-border bg-card p-4 transition hover:bg-accent/50",
                  index === 0 && "animate-enter-soft animate-delay-1",
                )}
              >
                <div className="flex items-center justify-between gap-4 text-left">
                  <div className="min-w-0 space-y-2">
                    <p className="truncate text-sm font-medium text-card-foreground">
                      {formatProfileName(profilesById[request.requester_id], request.requester_email)}
                    </p>
                    <p className="max-w-[36rem] text-sm text-muted-foreground">{requestKindLabels[request.kind]}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{formatRequestWhen(request)}</p>
                  </div>
                  <StatusPill status={request.status} />
                </div>
              </div>
            </a>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminRequestsView({
  requests,
  profilesById,
  statusView,
  setStatusView,
  onNavigate,
}: {
  requests: RequestRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
  statusView: RequestStatusView;
  setStatusView: (view: RequestStatusView) => void;
  onNavigate: (view: ShellView) => void;
}) {
  const visibleRequests = filterRequestsByView(requests, statusView);
  const reportSickRequests = visibleRequests.filter((request) => request.kind === "report_sick");
  const externalAppointmentRequests = visibleRequests.filter((request) => request.kind === "external_appointment");

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Card className="overflow-hidden animate-enter">
        <CardHeader className="space-y-4 p-8">
          <CardTitle className="text-3xl">Request Queue</CardTitle>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => onNavigate("dashboard")}>
              <ChevronLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
          </div>
        </CardHeader>
      </Card>

      <RequestStatusTabs activeView={statusView} onChange={setStatusView} />
      <RequestsByKindCard title="Report Sick" requests={reportSickRequests} profilesById={profilesById} statusView={statusView} />
      <RequestsByKindCard
        title="External Appointment"
        requests={externalAppointmentRequests}
        profilesById={profilesById}
        statusView={statusView}
      />
    </section>
  );
}

function NewRequestView({
  kind,
  profile,
  userEmail,
  onClose,
  onSaved,
}: {
  kind: RequestKind;
  profile: ProfileRecord | null;
  userEmail: string | null;
  onClose: () => void;
  onSaved: (request: RequestRecord) => void;
}) {
  return (
    <section className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="animate-enter">
          <RequestForm
            kind={kind}
            userEmail={userEmail ?? ""}
            userId={profile?.id ?? ""}
            requestId={null}
            onClose={onClose}
            onSaved={onSaved}
          />
        </div>
      </div>
    </section>
  );
}

export function InstsigApp({
  userEmail,
  profile,
  initialRequests,
  profilesById,
}: {
  userEmail: string | null;
  profile: ProfileRecord | null;
  initialRequests: RequestRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
}) {
  const [view, setView] = useState<ShellView>("dashboard");
  const [statusView, setStatusView] = useState<RequestStatusView>("pending");
  const [requests, setRequests] = useState(initialRequests);
  const isAdmin = profile?.role === "admin";

  const sortedRequests = useMemo(
    () => [...requests].sort((first, second) => Date.parse(second.updated_at) - Date.parse(first.updated_at)),
    [requests],
  );

  function navigate(nextView: ShellView) {
    if ((nextView === "admin" || nextView === "adminRequests") && !isAdmin) {
      setView("dashboard");
      return;
    }

    setView(nextView);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function handleSavedRequest(request: RequestRecord) {
    setRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
    setView("dashboard");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopBar
        role={isAdmin ? "admin" : "user"}
        userName={profile?.full_name}
        userRank={profile?.rank}
        userEmail={userEmail}
        onHome={() => navigate("dashboard")}
      />

      {view === "dashboard" ? (
        <DashboardView
          requests={sortedRequests}
          profile={profile}
          userEmail={userEmail}
          profilesById={profilesById}
          onNavigate={navigate}
        />
      ) : null}
      {view === "history" ? <HistoryView requests={sortedRequests} profile={profile} onNavigate={navigate} /> : null}
      {view === "admin" && isAdmin ? <AdminLandingView onNavigate={navigate} /> : null}
      {view === "adminRequests" && isAdmin ? (
        <AdminRequestsView
          requests={sortedRequests}
          profilesById={profilesById}
          statusView={statusView}
          setStatusView={setStatusView}
          onNavigate={navigate}
        />
      ) : null}
      {view === "newReportSick" ? (
        <NewRequestView
          kind="report_sick"
          profile={profile}
          userEmail={userEmail}
          onClose={() => navigate("dashboard")}
          onSaved={handleSavedRequest}
        />
      ) : null}
      {view === "newExternalAppointment" ? (
        <NewRequestView
          kind="external_appointment"
          profile={profile}
          userEmail={userEmail}
          onClose={() => navigate("dashboard")}
          onSaved={handleSavedRequest}
        />
      ) : null}
    </main>
  );
}
