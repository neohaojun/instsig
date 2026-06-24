"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, CalendarClock, ChevronLeft, FileText } from "lucide-react";
import { TopBar } from "@/components/layout/topbar";
import { AdminReportSickFollowupCard } from "@/components/request/admin-report-sick-followup-card";
import { AdminReviewPanel } from "@/components/request/admin-review-panel";
import { ExternalAppointmentRequestCard } from "@/components/request/external-appointment-card";
import { PageCloseButton } from "@/components/request/page-close-button";
import { ReportSickFollowupForm, ReportSickInitialRequestCard } from "@/components/request/report-sick-followup-form";
import { RequestForm } from "@/components/request/request-form";
import { RequestSummary } from "@/components/request/request-summary";
import { StatusPill } from "@/components/request/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatStatusDuration, getActiveReportSickStatuses } from "@/lib/active-report-sick-statuses";
import { formatProfileName } from "@/lib/profile-display";
import { requestKindLabels } from "@/lib/request-meta";
import type { BatchRecord, ProfileRecord, RequestKind, RequestRecord, RequestUpdateRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type ShellView = "dashboard" | "history" | "adminRequests" | "requestDetail" | "newReportSick" | "newExternalAppointment";
type DashboardMode = "admin" | "user";
type RequestDetailMode = "admin" | "user";
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

function isInitialRequestEditable(request: RequestRecord) {
  return ["draft", "pending", "needs_changes"].includes(request.status);
}

function RequestSubcard({
  title,
  meta,
  description,
  request,
  onSelect,
}: {
  title: string;
  meta: string;
  description?: string;
  request: RequestRecord;
  onSelect: (request: RequestRecord) => void;
}) {
  return (
    <button type="button" onClick={() => onSelect(request)} className="block w-full text-left">
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
    </button>
  );
}

function DashboardView({
  requests,
  updates,
  profile,
  profilesById,
  dashboardMode,
  setDashboardMode,
  onNavigate,
  onSelectRequest,
}: {
  requests: RequestRecord[];
  updates: RequestUpdateRecord[];
  profile: ProfileRecord | null;
  profilesById: Record<string, ProfileRecord | null | undefined>;
  dashboardMode: DashboardMode;
  setDashboardMode: (mode: DashboardMode) => void;
  onNavigate: (view: ShellView) => void;
  onSelectRequest: (request: RequestRecord, mode: RequestDetailMode) => void;
}) {
  const isAdmin = profile?.role === "admin";
  const pendingRequests = requests.filter(isIncompleteRequest);
  const requestHistory = requests.filter((request) => request.requester_id === profile?.id && request.status !== "draft");
  const recentRequestHistory = requestHistory.slice(0, 2);
  const recentPendingRequests = pendingRequests.slice(0, 2);
  const activeStatuses = getActiveReportSickStatuses(requests, updates);
  const activeMode = isAdmin ? dashboardMode : "user";

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Card className="overflow-hidden animate-enter">
        <CardHeader className="space-y-4 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-3xl">Dashboard</CardTitle>
            {isAdmin ? (
              <div className="w-fit max-w-full rounded-2xl border border-border bg-muted p-1">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "user" as const, label: "User" },
                    { value: "admin" as const, label: "Admin" },
                  ].map((mode) => {
                    const isActive = mode.value === activeMode;

                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => setDashboardMode(mode.value)}
                        className={cn(
                          "rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-background hover:text-foreground",
                          isActive && "bg-background text-foreground shadow-sm",
                        )}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {activeMode === "user" ? (
        <>
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
                    title={requestKindLabels[request.kind]}
                    meta={formatRequestWhen(request)}
                    request={request}
                    onSelect={(item) => onSelectRequest(item, "user")}
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
        </>
      ) : null}

      {activeMode === "admin" ? (
        <>
          <Card className="overflow-hidden animate-enter-soft animate-delay-1">
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
                    title={formatProfileName(profilesById[request.requester_id], request.requester_email)}
                    meta={formatRequestWhen(request)}
                    description={requestKindLabels[request.kind]}
                    request={request}
                    onSelect={(item) => onSelectRequest(item, "admin")}
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

          <Card className="overflow-hidden animate-enter-soft animate-delay-2">
            <CardHeader className="space-y-4 p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <CardTitle className="text-3xl">Active Statuses</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {activeStatuses.length} active {activeStatuses.length === 1 ? "status" : "statuses"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 p-8 pt-0">
              {activeStatuses.length ? (
                activeStatuses.slice(0, 4).map((status) => {
                  const requester = profilesById[status.request.requester_id];

                  return (
                    <div key={`${status.request.id}-${status.entry.type}-${status.entry.startDate}-${status.entry.endDate}`} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-2">
                          <p className="truncate text-sm font-medium text-card-foreground">
                            {formatProfileName(requester, status.request.requester_email)}
                          </p>
                          <p className="text-sm text-muted-foreground">{status.entry.type}</p>
                          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{formatStatusDuration(status)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  No active report sick statuses right now.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 animate-enter-soft animate-delay-2">
            <a href="/admin/users" className="block">
              <Card className="overflow-hidden transition hover:bg-accent/50">
                <CardHeader className="space-y-2 p-8">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-3xl">Manage Users</CardTitle>
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </a>
          </div>
        </>
      ) : null}
    </section>
  );
}

function HistoryView({
  requests,
  profile,
  onNavigate,
  onSelectRequest,
}: {
  requests: RequestRecord[];
  profile: ProfileRecord | null;
  onNavigate: (view: ShellView) => void;
  onSelectRequest: (request: RequestRecord, mode: RequestDetailMode) => void;
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

      <HistoryCard title="Report Sick" requests={reportSickRequests} emptyText="None found." onSelectRequest={onSelectRequest} />
      <HistoryCard
        title="External Appointment"
        requests={externalAppointmentRequests}
        emptyText="None found."
        onSelectRequest={onSelectRequest}
      />
    </section>
  );
}

function HistoryCard({
  title,
  requests,
  emptyText,
  onSelectRequest,
}: {
  title: string;
  requests: RequestRecord[];
  emptyText: string;
  onSelectRequest: (request: RequestRecord, mode: RequestDetailMode) => void;
}) {
  return (
    <Card className="overflow-hidden animate-enter">
      <CardHeader className="space-y-4 p-8">
        <CardTitle className="text-3xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-8 pt-0">
        {requests.length ? (
          requests.map((request, index) => (
            <button key={request.id} type="button" onClick={() => onSelectRequest(request, "user")} className="block w-full text-left">
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
            </button>
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
  onSelectRequest,
}: {
  title: string;
  requests: RequestRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
  statusView: RequestStatusView;
  onSelectRequest: (request: RequestRecord, mode: RequestDetailMode) => void;
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
            <button key={request.id} type="button" onClick={() => onSelectRequest(request, "admin")} className="block w-full text-left">
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
            </button>
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
  onSelectRequest,
}: {
  requests: RequestRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
  statusView: RequestStatusView;
  setStatusView: (view: RequestStatusView) => void;
  onNavigate: (view: ShellView) => void;
  onSelectRequest: (request: RequestRecord, mode: RequestDetailMode) => void;
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
      <RequestsByKindCard
        title="Report Sick"
        requests={reportSickRequests}
        profilesById={profilesById}
        statusView={statusView}
        onSelectRequest={onSelectRequest}
      />
      <RequestsByKindCard
        title="External Appointment"
        requests={externalAppointmentRequests}
        profilesById={profilesById}
        statusView={statusView}
        onSelectRequest={onSelectRequest}
      />
    </section>
  );
}

function RequesterCard({
  request,
  profilesById,
  batchesById,
}: {
  request: RequestRecord;
  profilesById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
}) {
  const requester = profilesById[request.requester_id];
  const requesterBatch = requester?.batch_id ? batchesById[requester.batch_id] : null;
  const requesterDisplayName = formatProfileName(requester, request.requester_email);
  const batchSummary = [
    requesterBatch?.name ? `Batch: ${requesterBatch.name}` : null,
    requester?.sscc_batch ? `SSCC batch: ${requester.sscc_batch}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2 p-6">
        <CardTitle className="text-base font-semibold text-foreground">Submitted by</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          {requesterDisplayName}
          {batchSummary ? ` · ${batchSummary}` : ""}
        </p>
      </CardHeader>
    </Card>
  );
}

function AdminRequestDetailView({
  request,
  followup,
  profile,
  userEmail,
  profilesById,
  batchesById,
  onBack,
  onRequestUpdated,
}: {
  request: RequestRecord;
  followup: RequestUpdateRecord | null;
  profile: ProfileRecord;
  userEmail: string | null;
  profilesById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
  onBack: () => void;
  onRequestUpdated: (request: RequestRecord) => void;
}) {
  const showRightPane = request.kind === "report_sick";

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <PageCloseButton className="flex justify-start" onClick={onBack} />
        <StatusPill status={request.status} />
      </div>

      <RequesterCard request={request} profilesById={profilesById} batchesById={batchesById} />

      <div className={`grid gap-6 ${showRightPane ? "xl:grid-cols-2" : "xl:grid-cols-[1fr_0.92fr]"}`}>
        <div className="animate-enter">
          {request.kind === "report_sick" ? (
            <ReportSickInitialRequestCard request={request} profilesById={profilesById} />
          ) : request.kind === "external_appointment" ? (
            <ExternalAppointmentRequestCard request={request} profilesById={profilesById} />
          ) : (
            <RequestSummary
              request={request}
              followup={followup}
              profilesById={profilesById}
              showLifecycle={false}
              showAdminNote={false}
            />
          )}
        </div>

        <div className="animate-enter-soft animate-delay-1 self-start xl:sticky xl:top-24">
          <div className="grid gap-4">
            {request.kind === "report_sick" && followup ? (
              <AdminReportSickFollowupCard request={request} followup={followup} profilesById={profilesById} />
            ) : null}
            <AdminReviewPanel
              request={request}
              adminId={profile.id}
              adminEmail={userEmail ?? ""}
              hasFollowup={Boolean(followup)}
              onClose={onBack}
              onUpdated={onRequestUpdated}
              showClose={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function UserRequestDetailView({
  request,
  followup,
  profile,
  userEmail,
  profilesById,
  onBack,
  onRequestUpdated,
  onFollowupSaved,
}: {
  request: RequestRecord;
  followup: RequestUpdateRecord | null;
  profile: ProfileRecord | null;
  userEmail: string | null;
  profilesById: Record<string, ProfileRecord | null | undefined>;
  onBack: () => void;
  onRequestUpdated: (request: RequestRecord) => void;
  onFollowupSaved: (request: RequestRecord, followup: RequestUpdateRecord) => void;
}) {
  const editableInitial = isInitialRequestEditable(request);
  const canEditFollowup = request.kind === "report_sick" && request.status === "approved";
  const hasRightPane = request.kind === "report_sick" && (canEditFollowup || Boolean(followup));
  const hasActiveForm = editableInitial || (canEditFollowup && !followup);

  return (
    <section className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className={`mx-auto grid max-w-7xl gap-6 ${hasRightPane ? "xl:grid-cols-2" : ""}`}>
        {!hasActiveForm ? (
          <div className={hasRightPane ? "xl:col-span-2 flex items-center justify-between gap-4" : "flex items-center justify-between gap-4"}>
            <PageCloseButton onClick={onBack} />
            <StatusPill status={request.status} />
          </div>
        ) : null}

        <div className="animate-enter">
          {editableInitial ? (
            <RequestForm
              kind={request.kind}
              userEmail={userEmail ?? ""}
              userId={profile?.id ?? request.requester_id}
              initialRequest={request}
              requestId={request.id}
              onClose={onBack}
              onSaved={onRequestUpdated}
            />
          ) : request.kind === "report_sick" ? (
            <ReportSickInitialRequestCard request={request} profilesById={profilesById} />
          ) : request.kind === "external_appointment" ? (
            <ExternalAppointmentRequestCard request={request} profilesById={profilesById} />
          ) : (
            <RequestSummary request={request} followup={followup} profilesById={profilesById} />
          )}
        </div>

        {hasRightPane ? (
          <div className="grid gap-4 self-start xl:sticky xl:top-24">
            {canEditFollowup && !followup ? (
              <ReportSickFollowupForm
                request={request}
                initialUpdate={followup}
                onClose={onBack}
                onSaved={onFollowupSaved}
              />
            ) : followup ? (
              <AdminReportSickFollowupCard request={request} followup={followup} profilesById={profilesById} />
            ) : null}
          </div>
        ) : null}
      </div>
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
  initialUpdates,
  profilesById,
  batchesById,
}: {
  userEmail: string | null;
  profile: ProfileRecord | null;
  initialRequests: RequestRecord[];
  initialUpdates: RequestUpdateRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
}) {
  const [view, setView] = useState<ShellView>("dashboard");
  const [returnView, setReturnView] = useState<ShellView>("dashboard");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedRequestMode, setSelectedRequestMode] = useState<RequestDetailMode>(profile?.role === "admin" ? "admin" : "user");
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>(profile?.role === "admin" ? "admin" : "user");
  const [statusView, setStatusView] = useState<RequestStatusView>("pending");
  const [requests, setRequests] = useState(initialRequests);
  const [updates, setUpdates] = useState(initialUpdates);
  const isAdmin = profile?.role === "admin";

  const sortedRequests = useMemo(
    () => [...requests].sort((first, second) => Date.parse(second.updated_at) - Date.parse(first.updated_at)),
    [requests],
  );
  const selectedRequest = selectedRequestId ? sortedRequests.find((request) => request.id === selectedRequestId) ?? null : null;
  const selectedFollowup = selectedRequest
    ? updates.find((update) => update.request_id === selectedRequest.id && update.kind === "doctor_followup") ?? null
    : null;

  function navigate(nextView: ShellView) {
    if (nextView === "adminRequests" && !isAdmin) {
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

  function handleSelectRequest(request: RequestRecord, mode: RequestDetailMode = isAdmin ? "admin" : "user") {
    setSelectedRequestId(request.id);
    setSelectedRequestMode(mode);
    setReturnView(view === "requestDetail" ? "dashboard" : view);
    setView("requestDetail");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function handleRequestUpdated(request: RequestRecord) {
    setRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
    setSelectedRequestId(request.id);
  }

  function handleFollowupSaved(request: RequestRecord, followup: RequestUpdateRecord) {
    handleRequestUpdated(request);
    setUpdates((current) => [followup, ...current.filter((item) => !(item.request_id === followup.request_id && item.kind === followup.kind))]);
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
          updates={updates}
          profile={profile}
          profilesById={profilesById}
          dashboardMode={dashboardMode}
          setDashboardMode={setDashboardMode}
          onNavigate={navigate}
          onSelectRequest={handleSelectRequest}
        />
      ) : null}
      {view === "history" ? (
        <HistoryView requests={sortedRequests} profile={profile} onNavigate={navigate} onSelectRequest={handleSelectRequest} />
      ) : null}
      {view === "adminRequests" && isAdmin ? (
        <AdminRequestsView
          requests={sortedRequests}
          profilesById={profilesById}
          statusView={statusView}
          setStatusView={setStatusView}
          onNavigate={navigate}
          onSelectRequest={handleSelectRequest}
        />
      ) : null}
      {view === "requestDetail" && selectedRequest ? (
        isAdmin && selectedRequestMode === "admin" ? (
          <AdminRequestDetailView
            request={selectedRequest}
            followup={selectedFollowup}
            profile={profile as ProfileRecord}
            userEmail={userEmail}
            profilesById={profilesById}
            batchesById={batchesById}
            onBack={() => navigate(returnView)}
            onRequestUpdated={handleRequestUpdated}
          />
        ) : (
          <UserRequestDetailView
            request={selectedRequest}
            followup={selectedFollowup}
            profile={profile}
            userEmail={userEmail}
            profilesById={profilesById}
            onBack={() => navigate(returnView)}
            onRequestUpdated={handleRequestUpdated}
            onFollowupSaved={handleFollowupSaved}
          />
        )
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
