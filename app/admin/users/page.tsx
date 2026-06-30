import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { ManageUsersClient } from "@/components/admin/manage-users-client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const [{ data: profiles }, { data: batches }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("batches").select("*").order("name", { ascending: true }),
  ]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-6 sm:p-8">
            <div className="max-w-3xl space-y-3">
              <CardTitle className="text-3xl leading-tight sm:text-4xl">Manage Users</CardTitle>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="outline">
                <Link href="/">
                  <ChevronLeft className="h-4 w-4" />
                  Back to dashboard
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <ManageUsersClient initialProfiles={profiles ?? []} batches={batches ?? []} />
      </section>
    </main>
  );
}
