import { redirect } from "next/navigation";
import { ArrowUpLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { BatchRecord } from "@/lib/types";
import { ManageBatchesClient } from "@/components/admin/manage-batches-client";

export default async function AdminBatchesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: batches } = await supabase.from("batches").select("*").order("created_at", { ascending: false });
  const batchRows = (batches ?? []) as BatchRecord[];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-6 sm:p-8">
            <div className="max-w-3xl space-y-3">
              <CardTitle className="text-3xl leading-tight sm:text-4xl">Manage Batches</CardTitle>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="outline">
                <Link href="/">
                  <ArrowUpLeft className="h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
        <ManageBatchesClient initialBatches={batchRows} />
      </section>
    </main>
  );
}
