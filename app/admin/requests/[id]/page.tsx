import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import Link from "next/link";
import { RequestSummary } from "@/components/request/request-summary";
import { AdminReviewPanel } from "@/components/request/admin-review-panel";
import type { ProfileRecord } from "@/lib/types";
import { requestKindLabels } from "@/lib/request-meta";
import { formatProfileName } from "@/lib/profile-display";

function buildProfilesMap(profiles: ProfileRecord[] | null | undefined) {
  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  return format(new Date(value), "dd MMM yyyy, HH:mm");
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
            <RequestSummary request={request} followup={updates?.[0] ?? null} profilesById={profilesById} />
            <div className="animate-enter-soft animate-delay-1">
              <AdminReviewPanel request={request} followup={updates?.[0] ?? null} adminId={profile.id} adminEmail={user.email ?? ""} />
            </div>
          </div>

          {updates?.length ? (
            <Card className="mt-6">
              <CardHeader>
                <Badge variant="outline" className="w-fit">
                  {requestKindLabels[request.kind as keyof typeof requestKindLabels]}
                </Badge>
                <CardTitle className="text-2xl">Update history</CardTitle>
                <CardDescription>Doctor follow-up submissions are tracked separately.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {updates.map((update) => {
                  const updater = update.created_by ? profilesById[update.created_by] : null;
                  return (
                    <div key={update.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-zinc-100">Doctor follow-up</p>
                        <p className="text-xs text-zinc-500">{formatDateTime(update.created_at)}</p>
                      </div>
                      <p className="text-sm text-zinc-400">
                        Submitted by {formatProfileName(updater, update.created_by_email)}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          <Button asChild variant="outline" className="mt-6 w-fit">
            <Link href="/admin/requests">Back to queue</Link>
          </Button>
        </section>
      </div>
    </main>
  );
}
