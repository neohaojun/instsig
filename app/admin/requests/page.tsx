import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestList } from "@/components/request/request-list";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminRequestsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: requests } = await supabase.from("requests").select("*").order("created_at", { ascending: false });
  const pendingCount = (requests ?? []).filter((request) => request.status === "pending").length;
  const reviewCount = (requests ?? []).filter((request) => request.status === "needs_changes").length;

  return (
    <main className="min-h-screen bg-[#09090b]">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <div className="mx-auto flex max-w-7xl">
        <Sidebar pathname="/admin/requests" role="admin" />
        <section className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <Card className="overflow-hidden animate-enter">
              <CardHeader className="space-y-4 p-8">
                <Badge variant="outline" className="w-fit">Request queue</Badge>
                <CardTitle className="text-4xl leading-tight sm:text-5xl">Process requests</CardTitle>
                <CardDescription className="text-base leading-7">Open a request to approve it, suggest edits, or finalize it.</CardDescription>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button asChild>
                    <Link href="/admin">Back to overview</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/admin/users">Users</Link>
                  </Button>
                </div>
              </CardHeader>
            </Card>
            <div className="grid gap-4">
              <Card className="animate-enter-soft animate-delay-1">
                <CardHeader>
                  <CardDescription>Pending</CardDescription>
                  <CardTitle className="text-3xl">{pendingCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="animate-enter-soft animate-delay-2">
                <CardHeader>
                  <CardDescription>Needs changes</CardDescription>
                  <CardTitle className="text-3xl">{reviewCount}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          </div>
          <RequestList
            requests={(requests ?? []) as any}
            getHref={(request) => `/admin/requests/${request.id}`}
          />
        </section>
      </div>
    </main>
  );
}
