import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { StrengthDetail } from "@/components/dashboard/strength-detail";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { buildStrengthDetails } from "@/lib/strength-summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRecord, RequestRecord, RequestUpdateRecord } from "@/lib/types";

function buildProfilesMap(profiles: ProfileRecord[] | null | undefined) {
  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
}

export default async function StrengthPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const [{ data: requests }, { data: profiles }] = await Promise.all([
    supabase.from("requests").select("*").order("updated_at", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("profiles").select("*"),
  ]);
  const requestRecords = (requests ?? []) as RequestRecord[];
  const reportSickRequestIds = requestRecords.filter((request) => request.kind === "report_sick").map((request) => request.id);
  const { data: requestUpdates } = reportSickRequestIds.length
    ? await supabase.from("request_updates").select("*").in("request_id", reportSickRequestIds).order("created_at", { ascending: true })
    : { data: [] as RequestUpdateRecord[] };
  const profileRecords = (profiles ?? []) as ProfileRecord[];
  const details = buildStrengthDetails(profileRecords, requestRecords, (requestUpdates ?? []) as RequestUpdateRecord[]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-8">
            <CardTitle className="text-3xl">Strength</CardTitle>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/">
                  <ChevronLeft className="h-4 w-4" />
                  Back to dashboard
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
        <StrengthDetail details={details} profilesById={buildProfilesMap(profileRecords)} showSummaryTitle={false} />
      </section>
    </main>
  );
}
