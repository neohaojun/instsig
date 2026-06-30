import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
        <Card className="mb-6 overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-8">
            <Badge variant="outline" className="w-fit">Batches</Badge>
            <CardTitle className="text-4xl leading-tight sm:text-5xl">Batch records</CardTitle>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild>
                <Link href="/admin">Back to overview</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
        <ManageBatchesClient initialBatches={batchRows} />
      </section>
    </main>
  );
}
