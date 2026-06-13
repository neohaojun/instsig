import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { RequestSummary } from "@/components/request/request-summary";
import { AdminReviewPanel } from "@/components/request/admin-review-panel";
import { AdminReportSickFollowupCard } from "@/components/request/admin-report-sick-followup-card";
import { ReportSickInitialRequestCard } from "@/components/request/report-sick-followup-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  if (profile?.role !== "admin") redirect("/dashboard");

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
    <main className="min-h-screen bg-[#09090b]">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="animate-enter">
          {(() => {
            const requester = profilesById[request.requester_id];
            const requesterBatch = requester?.batch_id ? batchesById[requester.batch_id] : null;
            const requesterDisplayName = formatProfileName(requester, request.requester_email);
            const batchNumbers = [requesterBatch?.name, requester?.sscc_batch].filter(Boolean).join(" / ");
            const platoonNames = [requester?.common_term_platoon, requester?.specialisation_phase_platoon].filter(Boolean).join(" / ");
            const requesterSummary = [
              requester?.rank,
              requester?.full_name,
              batchNumbers ? `Batch numbers: ${batchNumbers}` : null,
              platoonNames ? `Platoon names: ${platoonNames}` : null,
              requester?.nr ? `NR: ${requester.nr}` : null,
              request.requester_email,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <Card className="overflow-hidden">
                <CardHeader className="space-y-2 p-6">
                  <CardTitle className="text-base font-semibold text-zinc-100">Submitted by</CardTitle>
                  <CardDescription className="text-sm leading-6 text-zinc-400">
                    {requesterDisplayName}
                    {requesterSummary ? ` · ${requesterSummary}` : ""}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })()}
        </div>

        <div className={`grid gap-6 ${showRightPane ? "xl:grid-cols-2" : "xl:grid-cols-[1fr_0.92fr]"}`}>
          <div className="animate-enter">
            {request.kind === "report_sick" ? (
              <ReportSickInitialRequestCard request={request} profilesById={profilesById} />
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
              {request.kind === "report_sick" && followup ? <AdminReportSickFollowupCard followup={followup} /> : null}
              <AdminReviewPanel request={request} adminId={profile.id} adminEmail={user.email ?? ""} hasFollowup={Boolean(followup)} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
