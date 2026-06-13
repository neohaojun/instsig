import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/request/status-pill";
import type { ProfileRecord, RequestRecord } from "@/lib/types";
import { requestKindLabels } from "@/lib/request-meta";
import { formatProfileName } from "@/lib/profile-display";

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
    return format(parseISO(when), "dd/MM/yyyy, HH:mm");
  } catch {
    return when;
  }
}

function buildProfilesMap(profiles: ProfileRecord[] | null | undefined) {
  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
}

function PendingRequestsCard({
  title,
  requests,
  profilesById,
}: {
  title: string;
  requests: RequestRecord[];
  profilesById: Record<string, ProfileRecord | null | undefined>;
}) {
  return (
    <Card className="overflow-hidden animate-enter-soft">
      <CardHeader className="space-y-4 p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-3xl">{title}</CardTitle>
            <CardDescription>{requests.length} pending</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-8 pt-0">
        {requests.length ? (
          requests.map((request, index) => {
            const requester = profilesById[request.requester_id];

            return (
              <Link key={request.id} href={`/admin/requests/${request.id}`} className="block">
                <div
                  className={`group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05] ${index === 0 ? "animate-enter-soft animate-delay-1" : ""
                    }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 text-left">
                    <div className="min-w-0 space-y-2">
                      <p className="truncate text-sm font-medium text-zinc-100">{formatProfileName(requester, request.requester_email)}</p>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{formatPendingRequestWhen(request)}</p>
                    </div>
                    <StatusPill status={request.status} />
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-400">
            No pending requests right now.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function AdminRequestsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: requests } = await supabase.from("requests").select("*").order("created_at", { ascending: false });
  const pendingRequests = (requests ?? []).filter(isIncompleteRequest);
  const reportSickRequests = pendingRequests.filter((request) => request.kind === "report_sick");
  const externalAppointmentRequests = pendingRequests.filter((request) => request.kind === "external_appointment");

  const requesterIds = Array.from(new Set(pendingRequests.map((request) => request.requester_id)));
  const { data: requesters } = requesterIds.length
    ? await supabase.from("profiles").select("*").in("id", requesterIds)
    : { data: [] as ProfileRecord[] };
  const requestersById = buildProfilesMap(requesters);

  return (
    <main className="min-h-screen bg-[#09090b]">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-8">
            <div className="space-y-2">
              <CardTitle className="text-3xl">Pending Requests</CardTitle>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <PendingRequestsCard title="Report Sick" requests={reportSickRequests} profilesById={requestersById} />
        <PendingRequestsCard title="External Appointment" requests={externalAppointmentRequests} profilesById={requestersById} />
      </section>
    </main>
  );
}
