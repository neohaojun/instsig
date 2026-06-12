import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CalendarClock } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { ProfileRecord, RequestRecord } from "@/lib/types";
import { StatusPill } from "@/components/request/status-pill";
import { Badge } from "@/components/ui/badge";
import { requestKindLabels } from "@/lib/request-meta";
import { formatProfileName } from "@/lib/profile-display";

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
    return format(parseISO(when), "dd/MM/yyyy, HH:mm");
  } catch {
    return when;
  }
}

function buildProfilesMap(profiles: ProfileRecord[] | null | undefined) {
  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
}

function RequestSubcard({
  href,
  title,
  meta,
  status,
  badge,
  description,
}: {
  href: string;
  title: string;
  meta: string;
  status: RequestRecord["status"];
  badge?: string;
  description?: string;
}) {
  return (
    <Link href={href as never} className="block">
      <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05]">
        <div className="flex items-start justify-between gap-4 text-left">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium text-zinc-100">{title}</p>
              {badge ? (
                <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-zinc-300">
                  {badge}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{meta}</p>
            {description ? <p className="max-w-[36rem] text-sm text-zinc-400">{description}</p> : null}
          </div>
          <StatusPill status={status} />
        </div>
      </div>
    </Link>
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
  const pendingRequests = requests.filter(isIncompleteRequest);
  const requestHistory = requests.filter((request) => request.requester_id === user.id && request.status !== "draft");
  const recentRequestHistory = requestHistory.slice(0, 2);
  const isAdmin = profile?.role === "admin";
  const pendingRequestIds = Array.from(new Set(pendingRequests.map((request) => request.requester_id)));
  const { data: requesters } = pendingRequestIds.length
    ? await supabase.from("profiles").select("*").in("id", pendingRequestIds)
    : { data: [] as ProfileRecord[] };
  const requestersById = buildProfilesMap(requesters);
  const recentPendingRequests = pendingRequests.slice(0, 2);

  return (
    <main className="min-h-screen bg-[#09090b]">
      <TopBar role={isAdmin ? "admin" : "user"} userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <div className="mx-auto flex max-w-7xl">
        {isAdmin ? <Sidebar pathname="/dashboard" role="admin" /> : null}
        <section className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-6">
            <Card className="overflow-hidden animate-enter">
              <CardHeader className="space-y-4 p-8">
                <div className="space-y-2">
                  <CardTitle className="text-3xl">Dashboard</CardTitle>
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
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950/15 text-zinc-950">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold">Report Sick</p>
                      </div>
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-auto justify-start gap-4 py-6 text-left">
                    <Link href="/requests/external-appointment">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-100">
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
                      href={`/requests/${request.kind}?id=${request.id}`}
                      title={requestKindLabels[request.kind]}
                      meta={formatRequestWhen(request)}
                      status={request.status}
                    />
                  ))}
                  <div className="pt-2">
                    <Button asChild variant="link" className="h-auto px-0 text-zinc-200">
                      <Link href="/history">View all</Link>
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
                      <CardDescription>{pendingRequests.length} pending</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 p-8 pt-0">
                  {recentPendingRequests.length ? (
                    recentPendingRequests.map((request) => {
                      const requester = requestersById[request.requester_id];
                      const when = formatRequestWhen(request);
                      const title = formatProfileName(requester, request.requester_email);

                      return (
                        <RequestSubcard
                          key={request.id}
                          href={`/admin/requests/${request.id}`}
                          title={title}
                          meta={when}
                          status={request.status}
                          badge={requestKindLabels[request.kind]}
                        />
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-400">
                      No pending requests right now.
                    </div>
                  )}
                  <div className="pt-2">
                    <Button asChild variant="link" className="h-auto px-0 text-zinc-200">
                      <Link href="/admin/requests">View all</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
