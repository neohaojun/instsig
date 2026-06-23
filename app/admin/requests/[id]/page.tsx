import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { RequestSummary } from "@/components/request/request-summary";
import { AdminReviewPanel } from "@/components/request/admin-review-panel";
import { AdminReportSickFollowupCard } from "@/components/request/admin-report-sick-followup-card";
import { ExternalAppointmentRequestCard } from "@/components/request/external-appointment-card";
import { PageCloseButton } from "@/components/request/page-close-button";
import { ReportSickInitialRequestCard } from "@/components/request/report-sick-followup-form";
import { StatusPill } from "@/components/request/status-pill";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatProfileName } from "@/lib/profile-display";
import type { BatchRecord, ProfileRecord } from "@/lib/types";

function buildProfilesMap(profiles: ProfileRecord[] | null | undefined) {
  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
}

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { id } = await params;
  const [{ data: request }, { data: updates }] = await Promise.all([
    supabase.from("requests").select("*").eq("id", id).single(),
    supabase.from("request_updates").select("*").eq("request_id", id).order("created_at", { ascending: true }),
  ]);
  if (!request) notFound();

  const followup = updates?.find((update) => update.kind === "doctor_followup") ?? null;
  const { data: batches } = await supabase.from("batches").select("*").order("name", { ascending: true });

  const profileIds = [
    request.requester_id,
    request.approved_by,
    request.rejected_by,
    request.finalized_by,
    ...(updates ?? []).map((update) => update.created_by).filter(Boolean),
  ].filter(Boolean) as string[];
  const { data: people } = profileIds.length
    ? await supabase.from("profiles").select("*").in("id", profileIds)
    : { data: [] as ProfileRecord[] };
  const profilesById = buildProfilesMap(people);
  const batchesById = Object.fromEntries(((batches ?? []) as BatchRecord[]).map((batch) => [batch.id, batch]));
  const showRightPane = request.kind === "report_sick";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <PageCloseButton className="flex justify-start" />
          <StatusPill status={request.status} />
        </div>

        <div className="animate-enter">
          {(() => {
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
          })()}
        </div>

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
                adminEmail={user.email ?? ""}
                hasFollowup={Boolean(followup)}
                showClose={false}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
