import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { StrengthDatePicker } from "@/components/dashboard/strength-date-picker";
import { StrengthDetail } from "@/components/dashboard/strength-detail";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { buildStrengthDetails } from "@/lib/strength-summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BatchRecord, ProfileRecord, RequestRecord, RequestUpdateRecord } from "@/lib/types";

function buildProfilesMap(profiles: ProfileRecord[] | null | undefined) {
  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
}

export default async function StrengthPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const [{ data: requests }, { data: profiles }, { data: batches }] = await Promise.all([
    supabase.from("requests").select("*").order("updated_at", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("profiles").select("*"),
    supabase.from("batches").select("*"),
  ]);
  const requestRecords = (requests ?? []) as RequestRecord[];
  const reportSickRequestIds = requestRecords.filter((request) => request.kind === "report_sick").map((request) => request.id);
  const { data: requestUpdates } = reportSickRequestIds.length
    ? await supabase.from("request_updates").select("*").in("request_id", reportSickRequestIds).order("created_at", { ascending: true })
    : { data: [] as RequestUpdateRecord[] };
  const profileRecords = (profiles ?? []) as ProfileRecord[];
  const batchesById = Object.fromEntries(((batches ?? []) as BatchRecord[]).map((batch) => [batch.id, batch]));
  const { date } = await searchParams;
  const selectedDate = date && !Number.isNaN(Date.parse(date)) ? date : new Date().toISOString().slice(0, 10);
  const details = buildStrengthDetails(
    profileRecords,
    requestRecords,
    (requestUpdates ?? []) as RequestUpdateRecord[],
    batchesById,
    new Date(`${selectedDate}T00:00:00`),
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="relative z-10 overflow-visible animate-enter">
          <CardHeader className="space-y-4 p-8">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-3xl">Strength</CardTitle>
              <StrengthDatePicker value={selectedDate} />
            </div>
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
