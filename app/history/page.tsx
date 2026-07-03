import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/request/status-pill";
import Link from "next/link";
import type { RequestRecord } from "@/lib/types";
import { formatDisplayDateTime } from "@/lib/display-date";

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

  if (!when) return "Date not set";

  try {
    return formatDisplayDateTime(parseISO(when), "Date not set");
  } catch {
    return when;
  }
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
            <Link key={request.id} href={getHref(request) as never} className="block">
              <div
                className={`group rounded-2xl border border-border bg-card p-3 transition hover:bg-accent/50 ${index === 0 ? "animate-enter-soft animate-delay-1" : ""
                  }`}
              >
                <div className="flex items-center justify-between gap-4 text-left">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-card-foreground">{getMeta(request)}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDisplayDateTime(request.submitted_at ?? request.created_at)}
                    </p>
                  </div>
                  <StatusPill status={request.status} />
                </div>
              </div>
            </Link>
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
    <main className="min-h-screen bg-background text-foreground">
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
                  <Link href="/?mode=user">
                    <ChevronLeft className="h-4 w-4" />
                    Back to dashboard
                  </Link>
                </Button>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <HistoryCard
              title="Report Sick History"
              requests={reportSickRequests}
              emptyText="None found."
              getHref={(request) => `/requests/report-sick?id=${request.id}`}
              getMeta={formatReportSickReportedAt}
            />

            <HistoryCard
              title="Ext Appt History"
              requests={externalAppointmentRequests}
              emptyText="None found."
              getHref={(request) => `/requests/external-appointment?id=${request.id}`}
              getMeta={formatExternalAppointmentWhen}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
