"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, CalendarClock, ChevronLeft, ChevronRight, FileText, Search, X } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { StrengthCard } from "@/components/dashboard/strength-card";
import { StrengthDatePicker } from "@/components/dashboard/strength-date-picker";
import { StrengthDetail } from "@/components/dashboard/strength-detail";
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
import { Input } from "@/components/ui/input";
import { formatDisplayDateTime } from "@/lib/display-date";
import { formatProfileName } from "@/lib/profile-display";
import { buildRequestCardLines, formatRequestRequesterDescription } from "@/lib/request-card-display";
import { requestKindLabels } from "@/lib/request-meta";
import { buildStrengthDetails, buildStrengthSummary } from "@/lib/strength-summary";
import type { BatchRecord, ProfileRecord, RequestKind, RequestRecord, RequestUpdateRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type ShellView = "dashboard" | "history" | "adminRequests" | "strength" | "requestDetail" | "newReportSick" | "newExternalAppointment";
type DashboardMode = "admin" | "user";
type RequestDetailMode = "admin" | "user";
type RequestStatusView = "pending" | "all";
type RequestKindView = RequestKind;

const statusViews: { value: RequestStatusView; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "all", label: "All" },
];

const requestPathByKind = {
  report_sick: "/requests/report-sick",
  external_appointment: "/requests/external-appointment",
} as const;

const BACKGROUND_REFRESH_INTERVAL_MS = 60_000;

function isIncompleteRequest(request: RequestRecord) {
  if (request.kind === "report_sick") {
    return request.status !== "finalized" && request.status !== "rejected" && request.status !== "draft";
  }

  return request.status === "pending";
}

function isAwaitingDashboardAction(request: RequestRecord) {
  if (request.kind === "report_sick") {
    return request.status === "pending" || request.status === "submitted";
  }

  return request.status === "pending";
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
    return formatDisplayDateTime(parseISO(when), "Date not set");
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

function getAdminActionLabel(request: RequestRecord) {
  if (request.status === "finalized" || request.status === "rejected") return null;
  if (request.status === "pending" || request.status === "needs_changes") return "Review needed";
  if (request.kind === "report_sick" && (request.status === "submitted" || request.followup_submitted_at)) return "Ready to endorse";
  return null;
}

function getRequestSearchText(request: RequestRecord, requester: ProfileRecord | null | undefined) {
  const payload = request.payload as Record<string, unknown>;
  const payloadText = Object.values(payload)
    .filter((value) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .join(" ");

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
    formatRequestWhen(request),
    payloadText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterRequestsBySearch(
  requests: RequestRecord[],
  profilesById: Record<string, ProfileRecord | null | undefined>,
  searchQuery: string,
) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return requests;
  return requests.filter((request) => getRequestSearchText(request, profilesById[request.requester_id]).includes(normalizedQuery));
}

function sortActionableRequests(requests: RequestRecord[]) {
  return [...requests].sort((first, second) => {
    const firstActionable = getAdminActionLabel(first) ? 1 : 0;
    const secondActionable = getAdminActionLabel(second) ? 1 : 0;
    return secondActionable - firstActionable;
  });
}

function RequestSubcard({
  title,
  meta,
  description,
  showAdminAction = false,
  request,
  onSelect,
}: {
  title: string;
  meta: string;
  description?: string;
  showAdminAction?: boolean;
  request: RequestRecord;
  onSelect: (request: RequestRecord) => void;
}) {
  const actionLabel = showAdminAction ? getAdminActionLabel(request) : null;

  return (
    <button type="button" onClick={() => onSelect(request)} className="block w-full text-left">
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
          <div className="flex shrink-0 items-center gap-2">
            <StatusPill status={request.status} />
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </div>
        </div>
      </div>
    </button>
  );
}

function AdminPendingRequestsCard({
  title,
  requests,
  profilesById,
  batchesById,
  onSelectRequest,
  onViewAll,
}: {
  title: string;
  requests: RequestRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
  onSelectRequest: (request: RequestRecord, mode: RequestDetailMode) => void;
  onViewAll: () => void;
}) {
  return (
    <Card className="overflow-hidden animate-enter-soft animate-delay-1">
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
            const requester = profilesById[request.requester_id];
            const requesterBatch = requester?.batch_id ? batchesById[requester.batch_id] : null;

            return (
              <RequestSubcard
                key={request.id}
                title={formatProfileName(requester, request.requester_email)}
                description={formatRequestRequesterDescription(request, requester, requesterBatch)}
                meta={`Submitted ${formatDisplayDateTime(request.submitted_at ?? request.created_at)}`}
                showAdminAction
                request={request}
                onSelect={(item) => onSelectRequest(item, "admin")}
              />
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            No {title.toLowerCase()} awaiting action right now.
          </div>
        )}
        <div className="pt-2">
          <Button type="button" variant="link" className="h-auto px-0" onClick={onViewAll}>
            View all
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
  onViewAll,
  onSelectRequest,
}: {
  title: string;
  requests: RequestRecord[];
  kind: keyof typeof requestPathByKind;
  onViewAll: () => void;
  onSelectRequest: (request: RequestRecord, mode: RequestDetailMode) => void;
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
              title={formatRequestWhen(request)}
              meta={`Submitted ${formatDisplayDateTime(request.submitted_at ?? request.created_at)}`}
              request={request}
              onSelect={(item) => onSelectRequest(item, "user")}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            None found.
          </div>
        )}
        <div className="pt-2">
          <Button type="button" variant="link" className="h-auto px-0" onClick={onViewAll}>
            View all
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardView({
  requests,
  updates,
  profile,
  profilesById,
  batchesById,
  dashboardMode,
  setDashboardMode,
  onNavigate,
  onOpenAdminRequests,
  onSelectRequest,
}: {
  requests: RequestRecord[];
  updates: RequestUpdateRecord[];
  profile: ProfileRecord | null;
  profilesById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
  dashboardMode: DashboardMode;
  setDashboardMode: (mode: DashboardMode) => void;
  onNavigate: (view: ShellView) => void;
  onOpenAdminRequests: (kindView: RequestKindView) => void;
  onSelectRequest: (request: RequestRecord, mode: RequestDetailMode) => void;
}) {
  const isAdmin = profile?.role === "admin";
  const reportSickPendingRequests = requests.filter((request) => request.kind === "report_sick" && isAwaitingDashboardAction(request));
  const externalAppointmentPendingRequests = requests.filter((request) => request.kind === "external_appointment" && isAwaitingDashboardAction(request));
  const requestHistory = requests.filter((request) => request.requester_id === profile?.id && request.status !== "draft");
  const strengthSummary = buildStrengthSummary(
    Object.values(profilesById).filter(Boolean) as ProfileRecord[],
    requests,
    updates,
    batchesById,
  );
  const activeMode = isAdmin ? dashboardMode : "user";

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Card className="overflow-hidden animate-enter">
        <CardHeader className="space-y-4 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-3xl">{activeMode === "admin" ? "Admin Dashboard" : "Dashboard"}</CardTitle>
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

          <div className="grid gap-6 lg:grid-cols-2">
            <UserHistoryCard
              title="Report Sick History"
                requests={requestHistory}
                kind="report_sick"
                onViewAll={() => window.location.assign("/history")}
              onSelectRequest={onSelectRequest}
            />
            <UserHistoryCard
              title="Ext Appt History"
                requests={requestHistory}
                kind="external_appointment"
                onViewAll={() => window.location.assign("/history")}
              onSelectRequest={onSelectRequest}
            />
          </div>
        </>
      ) : null}

      {activeMode === "admin" ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <AdminPendingRequestsCard
              title="Report Sick Requests"
              requests={reportSickPendingRequests}
              profilesById={profilesById}
              batchesById={batchesById}
              onSelectRequest={onSelectRequest}
              onViewAll={() => onOpenAdminRequests("report_sick")}
            />
            <AdminPendingRequestsCard
              title="Ext Appt Requests"
              requests={externalAppointmentPendingRequests}
              profilesById={profilesById}
              batchesById={batchesById}
              onSelectRequest={onSelectRequest}
              onViewAll={() => onOpenAdminRequests("external_appointment")}
            />
          </div>

          <StrengthCard summary={strengthSummary} onSeeMore={() => onNavigate("strength")} />

          <div className="grid gap-4 animate-enter-soft animate-delay-2 sm:grid-cols-2">
            <Link href="/admin/users" className="block">
              <Card className="overflow-hidden transition hover:bg-accent/50">
                <CardHeader className="space-y-2 p-8">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-3xl">Manage Users</CardTitle>
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
            <Link href="/admin/batches" className="block">
              <Card className="overflow-hidden transition hover:bg-accent/50">
                <CardHeader className="space-y-2 p-8">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-3xl">Manage Batches</CardTitle>
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <HistoryCard title="Report Sick History" requests={reportSickRequests} emptyText="None found." onSelectRequest={onSelectRequest} />
        <HistoryCard
          title="Ext Appt History"
          requests={externalAppointmentRequests}
          emptyText="None found."
          onSelectRequest={onSelectRequest}
        />
      </div>
    </section>
  );
}

function StrengthView({
  requests,
  updates,
  profilesById,
  batchesById,
  onNavigate,
}: {
  requests: RequestRecord[];
  updates: RequestUpdateRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
  onNavigate: (view: ShellView) => void;
}) {
  const todayValue = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const strengthDate = parseISO(selectedDate || todayValue);
  const details = buildStrengthDetails(
    Object.values(profilesById).filter(Boolean) as ProfileRecord[],
    requests,
    updates,
    batchesById,
    strengthDate,
  );

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Card className="relative z-10 overflow-visible animate-enter">
        <CardHeader className="space-y-4 p-8">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-3xl">Strength</CardTitle>
            <StrengthDatePicker value={selectedDate} onValueChange={setSelectedDate} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => onNavigate("dashboard")}>
              <ChevronLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
          </div>
        </CardHeader>
      </Card>
      <StrengthDetail details={details} profilesById={profilesById} showSummaryTitle={false} />
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
  const countLabel = `${requests.length} ${requests.length === 1 ? "request" : "requests"}`;

  return (
    <Card className="overflow-hidden animate-enter-soft">
      <CardHeader className="space-y-4 p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-3xl">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{countLabel}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-8 pt-0">
        {requests.length ? (
          requests.map((request, index) => (
            <button key={request.id} type="button" onClick={() => onSelectRequest(request, "user")} className="block w-full text-left">
              <div
                className={cn(
                  "group rounded-2xl border border-border bg-card p-3 transition hover:bg-accent/50",
                  index === 0 && "animate-enter-soft animate-delay-1",
                )}
              >
                <div className="flex items-center justify-between gap-4 text-left">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-card-foreground">{formatRequestWhen(request)}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDisplayDateTime(request.submitted_at ?? request.created_at)}
                    </p>
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

function filterRequestsByKind(requests: RequestRecord[], kindView: RequestKindView) {
  return requests.filter((request) => request.kind === kindView);
}

function getQueueTitle(kindView: RequestKindView) {
  return kindView === "external_appointment" ? "Ext Appt Requests" : "Report Sick Requests";
}

function getQueueStats(requests: RequestRecord[], kindView: RequestKindView) {
  const sharedStats = [
    {
      label: "Pending",
      value: requests.filter((request) => request.status === "pending" || request.status === "needs_changes").length,
      dotClassName: "bg-yellow-500",
      valueClassName: "text-yellow-500",
    },
    {
      label: "Approved",
      value: requests.filter((request) => request.status === "approved").length,
      dotClassName: "bg-green-500",
      valueClassName: "text-green-500",
    },
    {
      label: "Rejected",
      value: requests.filter((request) => request.status === "rejected").length,
      dotClassName: "bg-red-500",
      valueClassName: "text-red-500",
    },
  ];

  if (kindView === "external_appointment") {
    return [
      ...sharedStats,
      {
        label: "Total",
        value: requests.filter((request) => request.status !== "draft").length,
        dotClassName: "bg-zinc-400",
        valueClassName: "text-foreground",
      },
    ];
  }

  return [
    ...sharedStats,
    {
      label: "Submitted",
      value: requests.filter((request) => request.status === "submitted").length,
      dotClassName: "bg-violet-500",
      valueClassName: "text-violet-500",
    },
    {
      label: "Endorsed",
      value: requests.filter((request) => request.status === "finalized").length,
      dotClassName: "bg-blue-500",
      valueClassName: "text-blue-500",
    },
    {
      label: "Total",
      value: requests.filter((request) => request.status !== "draft").length,
      dotClassName: "bg-zinc-400",
      valueClassName: "text-foreground",
    },
  ];
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

function RequestQueueSearch({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  return (
    <div className="min-w-full flex-1 animate-enter-soft md:min-w-96">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="request-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search users"
          className="pl-9 pr-10"
        />
        {searchQuery ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 px-0"
            onClick={() => setSearchQuery("")}
            aria-label="Clear request search"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function RequestQueueRow({
  request,
  requester,
  requesterBatch,
  followup,
  index,
  onSelectRequest,
}: {
  request: RequestRecord;
  requester: ProfileRecord | null | undefined;
  requesterBatch: BatchRecord | null | undefined;
  followup: RequestUpdateRecord | null | undefined;
  index: number;
  onSelectRequest: (request: RequestRecord, mode: RequestDetailMode) => void;
}) {
  const actionLabel = getAdminActionLabel(request);
  const detailFields = buildRequestCardLines(request, followup);

  return (
    <button key={request.id} type="button" onClick={() => onSelectRequest(request, "admin")} className="block w-full text-left">
      <div
        className={cn(
          "group h-full rounded-2xl border border-border bg-card p-4 transition hover:bg-accent/50",
          index === 0 && "animate-enter-soft animate-delay-1",
          actionLabel && "border-foreground/20 bg-muted/50 shadow-sm ring-1 ring-foreground/10",
        )}
      >
        <div className="grid h-full gap-3 text-left">
          <div className="min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-card-foreground">
                {actionLabel ? (
                  <span className="shrink-0 text-[15px] leading-none" aria-label={actionLabel}>
                    <span aria-hidden="true">⚠️</span>
                    <span className="sr-only">{actionLabel}</span>
                  </span>
                ) : null}
                <span className="truncate">{formatProfileName(requester, request.requester_email)}</span>
              </p>
              <StatusPill status={request.status} />
            </div>
            <p className="text-sm leading-5 text-muted-foreground">{formatRequestRequesterDescription(request, requester, requesterBatch)}</p>
            <div className="space-y-1 pt-2 text-sm leading-5 text-foreground">
              {detailFields.map((field) => (
                <p key={field.label}>
                  <span className="font-medium">{field.label}:</span> {field.value}
                </p>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Submitted {formatDisplayDateTime(request.submitted_at ?? request.created_at)}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

function QueueStats({
  stats,
}: {
  stats: { label: string; value: number; dotClassName: string; valueClassName: string }[];
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        stats.length <= 3 ? "lg:grid-cols-3" : stats.length <= 4 ? "lg:grid-cols-4" : stats.length <= 5 ? "lg:grid-cols-5" : "lg:grid-cols-6",
      )}
    >
      {stats.map((stat) => (
        <Card key={stat.label} className="overflow-hidden animate-enter-soft">
          <CardHeader className="space-y-3 p-6">
            <div className="flex items-center gap-3">
              <span className={cn("h-2.5 w-2.5 rounded-full", stat.dotClassName)} />
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            </div>
            <p className={cn("text-3xl font-bold leading-none", stat.valueClassName)}>{stat.value}</p>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function RequestsSection({
  requests,
  profilesById,
  batchesById,
  followupsByRequestId,
  statusView,
  onSelectRequest,
}: {
  requests: RequestRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
  followupsByRequestId: Record<string, RequestUpdateRecord | null | undefined>;
  statusView: RequestStatusView;
  onSelectRequest: (request: RequestRecord, mode: RequestDetailMode) => void;
}) {
  const emptyLabel =
    statusView === "pending" ? "No pending requests right now." : "No requests found for this view.";

  return (
    <section className="grid gap-4 animate-enter-soft">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {requests.length ? (
          sortActionableRequests(requests).map((request, index) => {
            const requester = profilesById[request.requester_id];
            const requesterBatch = requester?.batch_id ? batchesById[requester.batch_id] : null;

            return (
              <RequestQueueRow
                key={request.id}
                request={request}
                requester={requester}
                requesterBatch={requesterBatch}
                followup={followupsByRequestId[request.id]}
                index={index}
                onSelectRequest={onSelectRequest}
              />
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  );
}

function AdminRequestsView({
  requests,
  requestUpdates,
  profilesById,
  batchesById,
  statusView,
  setStatusView,
  kindView,
  searchQuery,
  setSearchQuery,
  onNavigate,
  onSelectRequest,
}: {
  requests: RequestRecord[];
  requestUpdates: RequestUpdateRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
  statusView: RequestStatusView;
  setStatusView: (view: RequestStatusView) => void;
  kindView: RequestKindView;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onNavigate: (view: ShellView) => void;
  onSelectRequest: (request: RequestRecord, mode: RequestDetailMode) => void;
}) {
  const kindRequests = filterRequestsByKind(requests, kindView);
  const visibleRequests = filterRequestsBySearch(filterRequestsByView(kindRequests, statusView), profilesById, searchQuery);
  const queueTitle = getQueueTitle(kindView);
  const stats = getQueueStats(kindRequests, kindView);
  const followupsByRequestId = Object.fromEntries(
    requestUpdates.map((update) => [update.request_id, update]),
  );

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Card className="overflow-hidden animate-enter">
        <CardHeader className="space-y-4 p-8">
          <CardTitle className="text-3xl">{queueTitle}</CardTitle>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => onNavigate("dashboard")}>
              <ChevronLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
          </div>
        </CardHeader>
      </Card>

      <QueueStats stats={stats} />

      <div className="flex flex-wrap gap-3">
        <RequestStatusTabs activeView={statusView} onChange={setStatusView} />
      </div>
      <RequestQueueSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <RequestsSection
        requests={visibleRequests}
        profilesById={profilesById}
        batchesById={batchesById}
        followupsByRequestId={followupsByRequestId}
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
  const batchSummary = formatRequestRequesterDescription(request, requester, requesterBatch);

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
  onRequestDeleted,
}: {
  request: RequestRecord;
  followup: RequestUpdateRecord | null;
  profile: ProfileRecord;
  userEmail: string | null;
  profilesById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
  onBack: () => void;
  onRequestUpdated: (request: RequestRecord) => void;
  onRequestDeleted: (requestId: string) => void;
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
              onDeleted={onRequestDeleted}
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
  initialDashboardMode,
  initialRequests,
  initialUpdates,
  profilesById,
  batchesById,
}: {
  userEmail: string | null;
  profile: ProfileRecord | null;
  initialDashboardMode?: DashboardMode;
  initialRequests: RequestRecord[];
  initialUpdates: RequestUpdateRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
}) {
  const router = useRouter();
  const lastRefreshAt = useRef(Date.now());
  const [view, setView] = useState<ShellView>("dashboard");
  const [returnView, setReturnView] = useState<ShellView>("dashboard");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedRequestMode, setSelectedRequestMode] = useState<RequestDetailMode>(profile?.role === "admin" ? "admin" : "user");
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>(initialDashboardMode ?? (profile?.role === "admin" ? "admin" : "user"));
  const [statusView, setStatusView] = useState<RequestStatusView>("pending");
  const [kindView, setKindView] = useState<RequestKindView>("report_sick");
  const [requestSearchQuery, setRequestSearchQuery] = useState("");
  const [requests, setRequests] = useState(initialRequests);
  const [updates, setUpdates] = useState(initialUpdates);
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    setRequests(initialRequests);
    setUpdates(initialUpdates);
    lastRefreshAt.current = Date.now();
  }, [initialRequests, initialUpdates]);

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState !== "visible") return;
      lastRefreshAt.current = Date.now();
      router.refresh();
    }

    function refreshStaleVisiblePage() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAt.current < BACKGROUND_REFRESH_INTERVAL_MS) return;
      refreshIfVisible();
    }

    const interval = window.setInterval(refreshIfVisible, BACKGROUND_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshStaleVisiblePage);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshStaleVisiblePage);
    };
  }, [router]);

  const sortedRequests = useMemo(
    () => [...requests].sort((first, second) => Date.parse(second.updated_at) - Date.parse(first.updated_at)),
    [requests],
  );
  const selectedRequest = selectedRequestId ? sortedRequests.find((request) => request.id === selectedRequestId) ?? null : null;
  const selectedFollowup = selectedRequest
    ? updates.find((update) => update.request_id === selectedRequest.id && update.kind === "doctor_followup") ?? null
    : null;

  function navigate(nextView: ShellView) {
    if ((nextView === "adminRequests" || nextView === "strength") && !isAdmin) {
      setView("dashboard");
      return;
    }

    if (
      nextView === "dashboard" &&
      (view === "history" ||
        view === "newReportSick" ||
        view === "newExternalAppointment" ||
        (view === "requestDetail" && selectedRequestMode === "user"))
    ) {
      setDashboardMode("user");
    }

    setView(nextView);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function openAdminRequests(nextKindView: RequestKindView = "report_sick") {
    router.push(`/admin/requests?kind=${nextKindView}`);
  }

  function handleSavedRequest(request: RequestRecord) {
    setRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
    setDashboardMode("user");
    setView("dashboard");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function handleSelectRequest(request: RequestRecord, mode: RequestDetailMode = isAdmin ? "admin" : "user") {
    if (mode === "admin") {
      router.push(`/admin/requests/${request.id}`);
      return;
    }

    router.push(requestDetailHref(request) as Route);
  }

  function handleRequestUpdated(request: RequestRecord) {
    setRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
    setSelectedRequestId(request.id);
  }

  function handleFollowupSaved(request: RequestRecord, followup: RequestUpdateRecord) {
    handleRequestUpdated(request);
    setUpdates((current) => [followup, ...current.filter((item) => !(item.request_id === followup.request_id && item.kind === followup.kind))]);
  }

  function handleRequestDeleted(requestId: string) {
    setRequests((current) => current.filter((request) => request.id !== requestId));
    setUpdates((current) => current.filter((update) => update.request_id !== requestId));
    setSelectedRequestId(null);
    navigate(returnView);
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
          batchesById={batchesById}
          dashboardMode={dashboardMode}
          setDashboardMode={setDashboardMode}
          onNavigate={navigate}
          onOpenAdminRequests={openAdminRequests}
          onSelectRequest={handleSelectRequest}
        />
      ) : null}
      {view === "history" ? (
        <HistoryView requests={sortedRequests} profile={profile} onNavigate={navigate} onSelectRequest={handleSelectRequest} />
      ) : null}
      {view === "adminRequests" && isAdmin ? (
        <AdminRequestsView
          requests={sortedRequests}
          requestUpdates={updates}
          profilesById={profilesById}
          batchesById={batchesById}
          statusView={statusView}
          setStatusView={setStatusView}
          kindView={kindView}
          searchQuery={requestSearchQuery}
          setSearchQuery={setRequestSearchQuery}
          onNavigate={navigate}
          onSelectRequest={handleSelectRequest}
        />
      ) : null}
      {view === "strength" && isAdmin ? (
        <StrengthView
          requests={sortedRequests}
          updates={updates}
          profilesById={profilesById}
          batchesById={batchesById}
          onNavigate={navigate}
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
            onRequestDeleted={handleRequestDeleted}
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
