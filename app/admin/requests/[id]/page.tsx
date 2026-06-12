import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { RequestSummary } from "@/components/request/request-summary";
import { AdminReviewPanel } from "@/components/request/admin-review-panel";
import { ReportSickInitialRequestCard } from "@/components/request/report-sick-followup-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatProfileName } from "@/lib/profile-display";
import type { ProfileRecord } from "@/lib/types";

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

  return (
    <main className="min-h-screen bg-[#09090b]">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
          <div className="animate-enter">
            <div className="grid gap-6">
              {(() => {
                const requester = profilesById[request.requester_id];

                return (
                  <Card className="overflow-hidden">
                    <CardHeader className="space-y-4 p-8">
                      <Badge variant="outline" className="w-fit">
                        Requester
                      </Badge>
                      <div className="space-y-2">
                        <CardTitle className="text-3xl">{formatProfileName(requester, request.requester_email)}</CardTitle>
                        <p className="text-sm text-zinc-400">{request.requester_email}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-8 pt-0">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">Rank</p>
                          <p className="mt-2 text-sm text-zinc-200">{requester?.rank ?? "Not set"}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">Full name</p>
                          <p className="mt-2 text-sm text-zinc-200">{requester?.full_name ?? "Not set"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
              {request.kind === "report_sick" ? (
                <ReportSickInitialRequestCard request={request} profilesById={profilesById} />
              ) : (
                <RequestSummary
                  request={request}
                  followup={updates?.[0] ?? null}
                  profilesById={profilesById}
                  showLifecycle={false}
                  showAdminNote={false}
                />
              )}
            </div>
          </div>
          <div className="animate-enter-soft animate-delay-1 self-start xl:sticky xl:top-24">
            <AdminReviewPanel request={request} adminId={profile.id} adminEmail={user.email ?? ""} />
          </div>
        </div>
      </section>
    </main>
  );
}
