import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowUpRight, FileText, Users } from "lucide-react";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-6 sm:p-8">
            <Badge variant="outline" className="w-fit">
              Admin
            </Badge>
            <div className="max-w-3xl space-y-3">
              <CardTitle className="text-3xl leading-tight sm:text-4xl">Choose a workspace</CardTitle>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/admin/requests" className="group block">
            <Card className="h-full overflow-hidden transition hover:bg-accent/50 animate-enter-soft animate-delay-1">
              <CardHeader className="space-y-4 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-secondary text-secondary-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground transition group-hover:text-foreground" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl">Request queue</CardTitle>
                </div>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/admin/users" className="group block">
            <Card className="h-full overflow-hidden transition hover:bg-accent/50 animate-enter-soft animate-delay-2">
              <CardHeader className="space-y-4 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-secondary text-secondary-foreground">
                    <Users className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground transition group-hover:text-foreground" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl">User directory</CardTitle>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </section>
    </main>
  );
}
