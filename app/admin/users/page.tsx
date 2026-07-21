import { redirect } from "next/navigation";
import { ArrowUpLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { ManageUsersClient } from "@/components/admin/manage-users-client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getAccessibleUnitIds, getBatchUnitIds, getDescendantUnitIds, getUnitLabel } from "@/lib/unit-scope";
import type { UnitMembershipRecord, UnitRecord } from "@/lib/types";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const [{ data: profiles }, { data: batches }, { data: units }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("batches").select("*").order("name", { ascending: true }),
    supabase.from("units").select("*").eq("active", true).order("name", { ascending: true }),
    supabase.from("unit_memberships").select("*").eq("profile_id", user.id),
  ]);
  const unitRows = (units ?? []) as UnitRecord[];
  const accessibleUnitIds = getAccessibleUnitIds(unitRows, (memberships ?? []) as UnitMembershipRecord[]);
  const accessibleUnits = unitRows.filter((unit) => accessibleUnitIds.has(unit.id));
  const { unit } = await searchParams;
  const selectedUnitIds = unit && accessibleUnitIds.has(unit) ? getDescendantUnitIds(unitRows, unit) : accessibleUnitIds;
  const scopedProfiles = (profiles ?? []).filter((person) => person.unit_id && selectedUnitIds.has(person.unit_id));
  const scopedUnits = accessibleUnits.filter((item) => selectedUnitIds.has(item.id));
  const batchUnitIds = getBatchUnitIds(unitRows);
  const scopedBatches = (batches ?? []).filter((batch) => selectedUnitIds.has(batch.unit_id) && batchUnitIds.has(batch.unit_id));
  const selectedBatchUnits = scopedUnits.filter((item) => batchUnitIds.has(item.id));
  const preferredUnitId = unit && selectedUnitIds.has(unit) ? unit : profile.unit_id;
  const defaultUnitId = preferredUnitId && batchUnitIds.has(preferredUnitId) ? preferredUnitId : selectedBatchUnits[0]?.id;
  const selectedUnit = unitRows.find((item) => item.id === unit);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid min-w-0 max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-6 sm:p-8">
            <div className="max-w-3xl space-y-3">
              <CardTitle className="text-3xl leading-tight sm:text-4xl">Manage Users</CardTitle>
              {selectedUnit ? <p className="text-sm text-muted-foreground">{getUnitLabel(selectedUnit)}</p> : null}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="outline">
                <Link href={unit ? `/?unit=${unit}` : "/"}>
                  <ArrowUpLeft className="h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <ManageUsersClient initialProfiles={scopedProfiles} batches={scopedBatches} units={scopedUnits} defaultUnitId={defaultUnitId} />
      </section>
    </main>
  );
}
