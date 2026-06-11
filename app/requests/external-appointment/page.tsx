import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RequestForm } from "@/components/request/request-form";
import { RequestSummary } from "@/components/request/request-summary";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileRecord } from "@/lib/types";

function buildProfilesMap(profiles: ProfileRecord[] | null | undefined) {
  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
}

function LockedNotice({ title, description }: { title: string; description: string }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <Badge variant="outline" className="w-fit">
          External appointment
        </Badge>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm leading-6 text-zinc-400">
        <p>Once reviewed, this request is read-only to the requester.</p>
      </CardContent>
    </Card>
  );
}

export default async function ExternalAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await searchParams;

  if (!id) {
    return (
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-2">
          <div className="animate-enter">
            <RequestForm kind="external_appointment" userEmail={user.email!} userId={user.id} />
          </div>
          <div className="grid gap-4 self-start xl:sticky xl:top-24">
            <LockedNotice
              title="Request review"
              description="Submit the request first, then wait for admin approval or rejection."
            />
          </div>
        </div>
      </main>
    );
  }

  const { data: initialRequest } = await supabase.from("requests").select("*").eq("id", id).single();
  if (!initialRequest || initialRequest.kind !== "external_appointment") {
    notFound();
  }

  const editable = ["draft", "pending", "needs_changes"].includes(initialRequest.status);
  const profileIds = [initialRequest.approved_by, initialRequest.rejected_by].filter(Boolean) as string[];
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("*").in("id", profileIds)
    : { data: [] as ProfileRecord[] };
  const profilesById = buildProfilesMap(profiles);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-2">
        <div className="animate-enter">
          {editable ? (
            <RequestForm kind="external_appointment" userEmail={user.email!} userId={user.id} initialRequest={initialRequest} />
          ) : (
            <RequestSummary request={initialRequest} profilesById={profilesById} />
          )}
        </div>
        <div className="grid gap-4 self-start xl:sticky xl:top-24">
          {initialRequest.approved_at || initialRequest.rejected_at ? (
            <LockedNotice
              title={initialRequest.approved_at ? "Request approved" : "Request rejected"}
              description={
                initialRequest.approved_at
                  ? "The admin review is complete and the request is now read-only."
                  : "The admin has closed this request, so it can no longer be edited."
              }
            />
          ) : (
            <LockedNotice
              title="Awaiting review"
              description="The request will stay pending until an admin approves or rejects it."
            />
          )}
        </div>
      </div>
    </main>
  );
}
