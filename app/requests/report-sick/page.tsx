import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RequestForm } from "@/components/request/request-form";
import { ReportSickFollowupForm, ReportSickInitialRequestCard } from "@/components/request/report-sick-followup-form";
import { ReportSickFollowupCard } from "@/components/request/report-sick-followup-display";
import { RequestSummary } from "@/components/request/request-summary";
import { PageCloseButton } from "@/components/request/page-close-button";
import { StatusPill } from "@/components/request/status-pill";
import type { ProfileRecord } from "@/lib/types";

function buildProfilesMap(profiles: ProfileRecord[] | null | undefined) {
  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
}

export default async function ReportSickPage({
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
            <RequestForm kind="report_sick" userEmail={user.email!} userId={user.id} />
          </div>
        </div>
      </main>
    );
  }

  const [{ data: request }, { data: updates }] = await Promise.all([
    supabase.from("requests").select("*").eq("id", id).single(),
    supabase.from("request_updates").select("*").eq("request_id", id).eq("kind", "doctor_followup").order("created_at", { ascending: true }),
  ]);

  if (!request || request.kind !== "report_sick") {
    notFound();
  }

  const followup = updates?.[0] ?? null;
  const editableInitial = ["draft", "pending", "needs_changes"].includes(request.status);
  const canEditFollowup = request.status === "approved";
  const hasRightPane = canEditFollowup || Boolean(followup);
  const hasActiveForm = editableInitial || (canEditFollowup && !followup);
  const showPageBack = !hasActiveForm;

  const profileIds = [
    request.approved_by,
    request.rejected_by,
    request.finalized_by,
    followup?.created_by,
  ].filter(Boolean) as string[];
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("*").in("id", profileIds)
    : { data: [] as ProfileRecord[] };
  const profilesById = buildProfilesMap(profiles);

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        {showPageBack ? (
          <div className="flex items-center justify-between gap-4">
            <PageCloseButton className="flex justify-start" />
            <StatusPill status={request.status} />
          </div>
        ) : null}

        <div className={`grid gap-6 ${hasRightPane ? "items-start xl:grid-cols-2" : ""}`}>
          <div className="animate-enter">
            {editableInitial ? (
              <RequestForm kind="report_sick" userEmail={user.email!} userId={user.id} initialRequest={request} />
            ) : request.kind === "report_sick" ? (
              <ReportSickInitialRequestCard
                request={request}
                profilesById={profilesById}
                className={hasRightPane ? "xl:max-w-none" : undefined}
              />
            ) : (
              <RequestSummary request={request} profilesById={profilesById} />
            )}
          </div>

          {hasRightPane ? (
            <div className="grid gap-4 self-start xl:sticky xl:top-24">
              {canEditFollowup && !followup ? (
                <ReportSickFollowupForm request={request} initialUpdate={followup} />
              ) : followup ? (
                <ReportSickFollowupCard
                  request={request}
                  followup={followup}
                  profilesById={profilesById}
                  className="xl:max-w-none"
                  idPrefix="user-report-sick-followup"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
