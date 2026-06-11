import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { BatchRecord } from "@/lib/types";
import { formatProfileName } from "@/lib/profile-display";

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

  return (
    <main className="min-h-screen bg-[#09090b]">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <div className="mx-auto flex max-w-7xl">
        <Sidebar pathname="/admin/users" role="admin" />
        <section className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Card className="mb-6 overflow-hidden animate-enter">
            <CardHeader className="space-y-4 p-8">
              <Badge variant="outline" className="w-fit">User management</Badge>
              <CardTitle className="text-4xl leading-tight sm:text-5xl">Users and roles</CardTitle>
              <CardDescription className="text-base leading-7">Review profiles, roles, and batch assignment status.</CardDescription>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>NR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(profiles ?? []).map((profileRow) => (
                    <TableRow key={profileRow.id}>
                      <TableCell className="font-medium text-zinc-100">{formatProfileName(profileRow, profileRow.email)}</TableCell>
                      <TableCell className="text-zinc-400">{profileRow.email}</TableCell>
                      <TableCell>
                        <Badge variant={profileRow.role === "admin" ? "default" : "secondary"}>{profileRow.role}</Badge>
                      </TableCell>
                      <TableCell className="text-zinc-400">{profileRow.rank ?? "Not set"}</TableCell>
                      <TableCell className="text-zinc-400">
                        {profileRow.batch_id ? batchesById[profileRow.batch_id]?.name ?? "Unknown batch" : "Not assigned"}
                      </TableCell>
                      <TableCell className="text-zinc-400">{profileRow.nr ?? "Not set"}</TableCell>
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
