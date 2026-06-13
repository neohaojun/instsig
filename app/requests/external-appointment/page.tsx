import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RequestForm } from "@/components/request/request-form";
import { ExternalAppointmentRequestCard } from "@/components/request/external-appointment-card";
import { PageCloseButton } from "@/components/request/page-close-button";
import type { ProfileRecord } from "@/lib/types";

function buildProfilesMap(profiles: ProfileRecord[] | null | undefined) {
  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
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
      <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="animate-enter">
            <RequestForm kind="external_appointment" userEmail={user.email!} userId={user.id} />
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
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="animate-enter">
          {editable ? (
            <RequestForm kind="external_appointment" userEmail={user.email!} userId={user.id} initialRequest={initialRequest} />
          ) : (
            <ExternalAppointmentRequestCard request={initialRequest} profilesById={profilesById} />
          )}
        </div>
        {!editable ? <PageCloseButton className="mt-6 flex justify-end" /> : null}
      </div>
    </main>
  );
}
