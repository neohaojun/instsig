import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ count: pendingCount }, { count: userCount }, { count: awaitingFollowupCount }] = await Promise.all([
    supabase.from("requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("requests").select("*", { count: "exact", head: true }).eq("kind", "report_sick").eq("status", "approved"),
  ]);

  const { count: needsChangesCount } = await supabase
    .from("requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "needs_changes");

  return (
    <main className="min-h-screen bg-[#09090b]">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="overflow-hidden animate-enter">
            <CardHeader className="space-y-4 p-8">
              <Badge variant="outline" className="w-fit">Admin overview</Badge>
              <div className="max-w-3xl space-y-4">
                <CardTitle className="text-4xl leading-tight sm:text-5xl">Queue and people</CardTitle>
                <CardDescription className="text-base leading-7">Open the request queue or jump to user management.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild>
                  <Link href="/admin/requests">Open queue</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/users">Manage users</Link>
                </Button>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4">
            <Card className="animate-enter-soft animate-delay-1">
              <CardHeader>
                <CardDescription>Pending</CardDescription>
                <CardTitle className="text-3xl">{pendingCount ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="animate-enter-soft animate-delay-2">
              <CardHeader>
                <CardDescription>Needs changes</CardDescription>
                <CardTitle className="text-3xl">{needsChangesCount ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="animate-enter-soft animate-delay-3">
              <CardHeader>
                <CardDescription>Awaiting follow-up</CardDescription>
                <CardTitle className="text-3xl">{awaitingFollowupCount ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="animate-enter-soft animate-delay-1">
            <CardHeader>
              <CardDescription>Pending requests</CardDescription>
              <CardTitle>{pendingCount ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="animate-enter-soft animate-delay-2">
            <CardHeader>
              <CardDescription>Registered users</CardDescription>
              <CardTitle>{userCount ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="animate-enter-soft animate-delay-3">
            <CardHeader>
              <CardDescription>Action path</CardDescription>
              <CardTitle>Approve / Suggest</CardTitle>
            </CardHeader>
          </Card>
          <Card className="animate-enter-soft animate-delay-3">
            <CardHeader>
              <CardDescription>Future modules</CardDescription>
              <CardTitle>Batches + users</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="animate-enter-soft animate-delay-2">
            <CardHeader>
              <CardTitle>Request queue</CardTitle>
              <CardDescription>Review, approve, or suggest edits.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/admin/requests">Open queue</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="animate-enter-soft animate-delay-3">
            <CardHeader>
              <CardTitle>User management</CardTitle>
              <CardDescription>Reserved for role and batch management.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/admin/users">Open users</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
