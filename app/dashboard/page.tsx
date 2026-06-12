import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CalendarClock } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { RequestRecord } from "@/lib/types";
import { StatusPill } from "@/components/request/status-pill";

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

function isIncompleteRequest(request: RequestRecord) {
  if (request.kind === "report_sick") {
    return request.status !== "finalized" && request.status !== "rejected" && request.status !== "draft";
  }

  return request.status !== "approved" && request.status !== "rejected" && request.status !== "draft";
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const [{ data: reportSickRequests }, { data: allRequests }] = await Promise.all([
    supabase
      .from("requests")
      .select("*")
      .eq("requester_id", user.id)
      .eq("kind", "report_sick")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("requests").select("*").order("updated_at", { ascending: false }).order("created_at", { ascending: false }),
  ]);

  const pendingRequests = (allRequests ?? []).filter(isIncompleteRequest);
  const isAdmin = profile?.role === "admin";

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

            {(reportSickRequests ?? []).length ? (
              <Card className="overflow-hidden animate-enter-soft animate-delay-1">
                <CardHeader className="space-y-4 p-8">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <CardTitle className="text-3xl">Existing Requests</CardTitle>
                    </div>
                    <div>
                      <Button asChild variant="link" className="h-auto px-0 text-zinc-200">
                        <Link href="/history">View existing requests</Link>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 p-8 pt-0">
                  {(reportSickRequests ?? []).map((request) => (
                    <Link key={request.id} href={`/requests/report-sick?id=${request.id}`} className="block">
                      <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05]">
                        <div className="flex items-center justify-between gap-4 text-left">
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-medium text-zinc-100">Report Sick</p>
                            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{formatReportedAt(request)}</p>
                          </div>
                          <StatusPill status={request.status} />
                        </div>
                      </div>
                    </Link>
                  ))}
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
                    <div>
                      <Button asChild variant="link" className="h-auto px-0 text-zinc-200">
                        <Link href="/admin/requests">View all</Link>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
