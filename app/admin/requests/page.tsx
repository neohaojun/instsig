import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ChevronLeft, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/request/status-pill";
import type { BatchRecord, ProfileRecord, RequestRecord, RequestUpdateRecord, UnitRecord } from "@/lib/types";
import { formatProfileName } from "@/lib/profile-display";
import { cn } from "@/lib/utils";
import { formatDisplayDateTime } from "@/lib/display-date";
import { requestKindLabels } from "@/lib/request-meta";
import { buildRequestCardLines, formatRequestRequesterDescription } from "@/lib/request-card-display";
import { getDescendantUnitIds, getUnitLabel } from "@/lib/unit-scope";
import { RequestQueueClient } from "@/components/admin/request-queue-client";

type RequestStatusView = "pending" | "all";
type RequestKindView = "report_sick" | "external_appointment";

const statusViews: { value: RequestStatusView; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "all", label: "All" },
];

function isIncompleteRequest(request: RequestRecord) {
  if (request.kind === "report_sick") {
    return request.status !== "finalized" && request.status !== "rejected" && request.status !== "draft";
  }

  return request.status === "pending";
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
  if (request.kind === "report_sick" && (request.status === "submitted" || request.followup_submitted_at)) {
    return "Ready to endorse";
  }
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
    formatPendingRequestWhen(request),
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

function filterRequestsByView(requests: RequestRecord[], statusView: RequestStatusView) {
  if (statusView === "all") return requests;
  return requests.filter(isIncompleteRequest);
}

function filterRequestsByKind(requests: RequestRecord[], kindView: RequestKindView) {
  return requests.filter((request) => request.kind === kindView);
}

function resolveStatusView(status: string | string[] | undefined): RequestStatusView {
  const value = Array.isArray(status) ? status[0] : status;
  return statusViews.some((view) => view.value === value) ? (value as RequestStatusView) : "pending";
}

function resolveKindView(kind: string | string[] | undefined): RequestKindView {
  const value = Array.isArray(kind) ? kind[0] : kind;
  return value === "external_appointment" ? "external_appointment" : "report_sick";
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

function buildQueueHref({
  statusView,
  kindView,
  searchQuery,
  unitId,
}: {
  statusView: RequestStatusView;
  kindView: RequestKindView;
  searchQuery: string;
  unitId?: string;
}) {
  const query = {
    ...(statusView === "all" ? { status: statusView } : {}),
    kind: kindView,
    ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
    ...(unitId ? { unit: unitId } : {}),
  };

  return Object.keys(query).length ? { pathname: "/admin/requests", query } : { pathname: "/admin/requests" };
}

function RequestStatusTabs({
  activeView,
  kindView,
  searchQuery,
  unitId,
}: {
  activeView: RequestStatusView;
  kindView: RequestKindView;
  searchQuery: string;
  unitId?: string;
}) {
  return (
    <div className="w-fit max-w-full rounded-2xl border border-border bg-muted p-1">
      <div className="flex flex-wrap gap-2">
        {statusViews.map((view) => {
          const isActive = view.value === activeView;
          const href = buildQueueHref({ statusView: view.value, kindView, searchQuery, unitId });

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

function RequestQueueSearch({
  statusView,
  kindView,
  searchQuery,
  unitId,
}: {
  statusView: RequestStatusView;
  kindView: RequestKindView;
  searchQuery: string;
  unitId?: string;
}) {
  return (
    <form action="/admin/requests" className="flex flex-wrap items-end gap-3 animate-enter-soft">
      {statusView === "all" ? <input type="hidden" name="status" value={statusView} /> : null}
      <input type="hidden" name="kind" value={kindView} />
      {unitId ? <input type="hidden" name="unit" value={unitId} /> : null}
      <div className="min-w-full flex-1 md:min-w-96">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="request-search"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search users"
            className="pl-9 pr-10"
          />
          {searchQuery ? (
            <Button asChild type="button" size="sm" variant="ghost" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 px-0">
              <Link href={buildQueueHref({ statusView, kindView, searchQuery: "", unitId })} aria-label="Clear request search">
                <X className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      <Button type="submit">Search</Button>
    </form>
  );
}

function RequestQueueRow({
  request,
  requester,
  requesterBatch,
  followup,
  index,
}: {
  request: RequestRecord;
  requester: ProfileRecord | null | undefined;
  requesterBatch: BatchRecord | null | undefined;
  followup: RequestUpdateRecord | null | undefined;
  index: number;
}) {
  const actionLabel = getAdminActionLabel(request);
  const detailFields = buildRequestCardLines(request, followup);

  return (
    <Link href={`/admin/requests/${request.id}`} className="block">
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
            <p className="text-sm leading-5 text-muted-foreground">
              {formatRequestRequesterDescription(request, requester, requesterBatch)}
            </p>
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
    </Link>
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
}: {
  requests: RequestRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
  batchesById: Record<string, BatchRecord | null | undefined>;
  followupsByRequestId: Record<string, RequestUpdateRecord | null | undefined>;
  statusView: RequestStatusView;
}) {
  const emptyLabel =
    statusView === "pending" ? "No pending requests found." : "None found.";

  return (
    <section key={statusView} className="grid gap-4 animate-enter-soft">
      <div
        className={cn(
          "grid gap-3",
          statusView === "pending" ? "grid-cols-1" : "md:grid-cols-2 xl:grid-cols-3",
        )}
      >
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

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; kind?: string | string[]; q?: string | string[]; unit?: string | string[] }>;
}) {
  const { status, kind, q, unit } = await searchParams;
  const unitId = Array.isArray(unit) ? unit[0] : unit;
  const statusView = resolveStatusView(status);
  const kindView = resolveKindView(kind);
  const queueTitle = getQueueTitle(kindView);
  const searchQuery = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const [{ data: requests }, { data: units }] = await Promise.all([
    supabase.from("requests").select("*").order("created_at", { ascending: false }),
    supabase.from("units").select("*").eq("active", true),
  ]);
  const unitIds = unitId ? getDescendantUnitIds((units ?? []) as UnitRecord[], unitId) : null;
  const selectedUnit = ((units ?? []) as UnitRecord[]).find((item) => item.id === unitId);
  const unitRequests = unitIds ? (requests ?? []).filter((request) => unitIds.has(request.unit_id)) : (requests ?? []);
  const kindRequests = filterRequestsByKind(unitRequests, kindView);
  const baseRequests = kindRequests;

  const requesterIds = Array.from(new Set(baseRequests.map((request) => request.requester_id)));
  const baseRequestIds = baseRequests.map((request) => request.id);
  const [{ data: requesters }, { data: requestUpdates }, { data: batches }] = await Promise.all([
    requesterIds.length
      ? supabase.from("profiles").select("*").in("id", requesterIds)
      : Promise.resolve({ data: [] as ProfileRecord[] }),
    baseRequestIds.length
      ? supabase.from("request_updates").select("*").in("request_id", baseRequestIds).eq("kind", "doctor_followup")
      : Promise.resolve({ data: [] as RequestUpdateRecord[] }),
    supabase.from("batches").select("*"),
  ]);
  const requestersById = buildProfilesMap(requesters);
  const batchesById = Object.fromEntries(((batches ?? []) as BatchRecord[]).map((batch) => [batch.id, batch]));
  const followupsByRequestId = Object.fromEntries(
    ((requestUpdates ?? []) as RequestUpdateRecord[]).map((update) => [update.request_id, update]),
  );
  const stats = getQueueStats(kindRequests, kindView);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-8">
            <CardTitle className="text-3xl">{queueTitle}</CardTitle>
            {selectedUnit ? <p className="text-sm text-muted-foreground">{getUnitLabel(selectedUnit)}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href={unitId ? `/?unit=${unitId}` : "/"}>
                  <ChevronLeft className="h-4 w-4" />
                  Back to dashboard
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <QueueStats stats={stats} />

        <RequestQueueClient
          requests={baseRequests}
          profilesById={requestersById}
          batchesById={batchesById}
          followupsByRequestId={followupsByRequestId}
          initialStatusView={statusView}
          initialSearchQuery={searchQuery}
        />
      </section>
    </main>
  );
}
