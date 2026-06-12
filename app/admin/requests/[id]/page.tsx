import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { RequestSummary } from "@/components/request/request-summary";
import { AdminReviewPanel } from "@/components/request/admin-review-panel";
import { ReportSickInitialRequestCard } from "@/components/request/report-sick-followup-form";
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
      <div className="mx-auto flex max-w-7xl">
        <Sidebar pathname="/admin/requests" role="admin" />
        <section className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
            <div className="animate-enter">
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
            <div className="animate-enter-soft animate-delay-1 self-start xl:sticky xl:top-24">
              <AdminReviewPanel request={request} adminId={profile.id} adminEmail={user.email ?? ""} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
