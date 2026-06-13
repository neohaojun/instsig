import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { BatchRecord } from "@/lib/types";
import { formatProfileName } from "@/lib/profile-display";

function profileValue(value: string | null | undefined) {
  return value && value.trim() ? value : "Not set";
}

function UserProfileCard({
  profileRow,
  batchName,
}: {
  profileRow: {
    id: string;
    email: string;
    full_name: string | null;
    rank: string | null;
    role: string;
    batch_id: string | null;
    common_term_platoon: string | null;
    sscc_batch: string | null;
    specialisation_phase_platoon: string | null;
    nr: string | null;
  };
  batchName: string;
}) {
  const displayName = formatProfileName(profileRow, profileRow.email);

  return (
    <Card className="overflow-hidden border-white/10 bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.05]">
      <CardHeader className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate text-xl">{displayName}</CardTitle>
            <p className="break-all text-sm text-zinc-400">{profileRow.email}</p>
          </div>
          <Badge variant={profileRow.role === "admin" ? "default" : "secondary"} className="shrink-0">
            {profileRow.role}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-5 pt-0 sm:p-6 sm:pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoField label="Rank" value={profileValue(profileRow.rank)} />
          <InfoField label="NR" value={profileValue(profileRow.nr)} />
          <InfoField label="Batch" value={profileValue(batchName)} />
          <InfoField label="SSCC batch" value={profileValue(profileRow.sscc_batch)} />
          <InfoField label="Common term platoon" value={profileValue(profileRow.common_term_platoon)} className="sm:col-span-2" />
          <InfoField
            label="Specialisation phase platoon"
            value={profileValue(profileRow.specialisation_phase_platoon)}
            className="sm:col-span-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <div className="mt-2 rounded-2xl border border-white/10 bg-zinc-950/35 px-4 py-3 text-sm leading-6 text-zinc-200">
        {value}
      </div>
    </div>
  );
}

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ data: profiles }, { data: batches }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("batches").select("*").order("name", { ascending: true }),
  ]);
  const batchesById = Object.fromEntries(((batches ?? []) as BatchRecord[]).map((batch) => [batch.id, batch]));
  const sortedProfiles = [...(profiles ?? [])].sort((a, b) =>
    formatProfileName(a, a.email).localeCompare(formatProfileName(b, b.email), undefined, { sensitivity: "base" }),
  );

  return (
    <main className="min-h-screen bg-[#09090b]">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-6 sm:p-8">
            <Badge variant="outline" className="w-fit">
              User management
            </Badge>
            <div className="max-w-3xl space-y-3">
              <CardTitle className="text-3xl leading-tight sm:text-4xl">Users and roles</CardTitle>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="outline">
                <Link href="/admin">Back to overview</Link>
              </Button>
              <Button asChild>
                <Link href="/admin/requests">Open request queue</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedProfiles.map((profileRow, index) => {
            const batchName = profileRow.batch_id ? batchesById[profileRow.batch_id]?.name ?? "Unknown batch" : "Not assigned";

            return (
              <div key={profileRow.id} className={index < 2 ? "animate-enter-soft" : ""}>
                <UserProfileCard profileRow={profileRow} batchName={batchName} />
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
