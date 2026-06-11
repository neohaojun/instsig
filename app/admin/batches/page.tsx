import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import type { BatchRecord } from "@/lib/types";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return format(new Date(value), "dd MMM yyyy, HH:mm");
}

export default async function AdminBatchesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: batches } = await supabase.from("batches").select("*").order("created_at", { ascending: false });
  const batchRows = (batches ?? []) as BatchRecord[];

  return (
    <main className="min-h-screen bg-[#09090b]">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <div className="mx-auto flex max-w-7xl">
        <Sidebar pathname="/admin/batches" role="admin" />
        <section className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Card className="mb-6 overflow-hidden animate-enter">
            <CardHeader className="space-y-4 p-8">
              <Badge variant="outline" className="w-fit">Batches</Badge>
              <CardTitle className="text-4xl leading-tight sm:text-5xl">Batch records</CardTitle>
              <CardDescription className="text-base leading-7">View and prepare batch data for later assignment workflows.</CardDescription>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild>
                  <Link href="/admin">Back to overview</Link>
                </Button>
              </div>
            </CardHeader>
          </Card>
          <Card className="animate-enter-soft animate-delay-1">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firestore ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Course start</TableHead>
                    <TableHead>Common term end</TableHead>
                    <TableHead>Course end</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchRows.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="text-zinc-400">{batch.firestore_id ?? "Not set"}</TableCell>
                      <TableCell className="font-medium text-zinc-100">{batch.name}</TableCell>
                      <TableCell className="text-zinc-400">{formatDate(batch.course_start)}</TableCell>
                      <TableCell className="text-zinc-400">{formatDate(batch.common_term_end)}</TableCell>
                      <TableCell className="text-zinc-400">{formatDate(batch.course_end)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
