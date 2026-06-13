import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="min-h-screen bg-[#09090b]">
      <TopBar role="admin" userName={profile?.full_name} userRank={profile?.rank} userEmail={user.email} />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden animate-enter">
          <CardHeader className="space-y-4 p-6 sm:p-8">
            <Badge variant="outline" className="w-fit">
              Admin
            </Badge>
            <div className="max-w-3xl space-y-3">
              <CardTitle className="text-3xl leading-tight sm:text-4xl">Choose a workspace</CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7">
                Jump straight to the request queue or the user directory.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/admin/requests" className="group block">
            <Card className="h-full overflow-hidden transition hover:border-white/20 hover:bg-white/[0.04] animate-enter-soft animate-delay-1">
              <CardHeader className="space-y-4 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-100">
                    <FileText className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-300" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl">Request queue</CardTitle>
                  <CardDescription className="leading-7">
                    Review report sick and external appointment requests.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/admin/users" className="group block">
            <Card className="h-full overflow-hidden transition hover:border-white/20 hover:bg-white/[0.04] animate-enter-soft animate-delay-2">
              <CardHeader className="space-y-4 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-100">
                    <Users className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-300" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl">User directory</CardTitle>
                  <CardDescription className="leading-7">
                    View profiles, ranks, batches, and platoon assignments.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </section>
    </main>
  );
}
