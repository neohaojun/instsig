import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/request/status-pill";
import Link from "next/link";
import type { RequestRecord } from "@/lib/types";
import { requestKindLabels } from "@/lib/request-meta";
import { ChevronLeft } from "lucide-react";

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

function formatExternalAppointmentWhen(request: RequestRecord) {
  const payload = request.payload as Record<string, unknown>;
  const when = typeof payload.when === "string" ? payload.when : null;

  return when || "Date not set";
}

function HistoryCard({
  title,
  requests,
  emptyText,
  getHref,
  getMeta,
}: {
  title: string;
  requests: RequestRecord[];
  emptyText: string;
  getHref: (request: RequestRecord) => string;
  getMeta: (request: RequestRecord) => string;
}) {
  return (
    <Card className="overflow-hidden animate-enter">
      <CardHeader className="space-y-4 p-8">
        <CardTitle className="text-3xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-8 pt-0">
        {requests.length ? (
          requests.map((request, index) => (
            <Link key={request.id} href={getHref(request) as never} className="block">
              <div
                className={`group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05] ${index === 0 ? "animate-enter-soft animate-delay-1" : ""
                  }`}
              >
                <div className="flex items-center justify-between gap-4 text-left">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-zinc-100">{requestKindLabels[request.kind]}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{getMeta(request)}</p>
                  </div>
                  <StatusPill status={request.status} />
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-400">
            {emptyText}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function isExistingRequest(request: RequestRecord) {
  return request.status !== "draft";
}

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: requests }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("requests").select("*").eq("requester_id", user.id).order("created_at", { ascending: false }),
  ]);

  const reportSickRequests = (requests ?? []).filter((request) => request.kind === "report_sick" && isExistingRequest(request));

  const externalAppointmentRequests = (requests ?? []).filter(
    (request) => request.kind === "external_appointment" && isExistingRequest(request),
  );

  return (
    <main className="min-h-screen bg-[#09090b]">
      <TopBar userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6">
          <Card className="overflow-hidden animate-enter">
            <CardHeader className="space-y-4 p-8">
              <div className="space-y-2">
                <CardTitle className="text-3xl">Request History</CardTitle>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </div>
            </CardHeader>
          </Card>

          <HistoryCard
            title="Report Sick"
            requests={reportSickRequests}
            emptyText="None found."
            getHref={(request) => `/requests/report-sick?id=${request.id}`}
            getMeta={formatReportSickReportedAt}
          />

          <HistoryCard
            title="External Appointment"
            requests={externalAppointmentRequests}
            emptyText="None found."
            getHref={(request) => `/requests/external-appointment?id=${request.id}`}
            getMeta={formatExternalAppointmentWhen}
          />
        </div>
      </div>
    </main>
  );
}
