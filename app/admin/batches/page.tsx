import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BatchRecord } from "@/lib/types";
import { formatDisplayDateTime } from "@/lib/display-date";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return formatDisplayDateTime(value, "Not set");
}

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
                    <TableCell className="text-muted-foreground">{batch.firestore_id ?? "Not set"}</TableCell>
                    <TableCell className="font-medium text-foreground">{batch.name}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(batch.course_start)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(batch.common_term_end)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(batch.course_end)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
