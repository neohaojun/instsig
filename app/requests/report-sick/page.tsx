import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RequestForm } from "@/components/request/request-form";
import { ReportSickFollowupForm, ReportSickInitialRequestCard } from "@/components/request/report-sick-followup-form";
import { ReadOnlyField, RequestSummary, formatReportSickFollowupStatuses } from "@/components/request/request-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileRecord, RequestUpdateRecord } from "@/lib/types";
import { formatProfileName } from "@/lib/profile-display";

function buildProfilesMap(profiles: ProfileRecord[] | null | undefined) {
  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  return format(new Date(value), "dd MMM yyyy, HH:mm");
}

function PostVisitSummaryCard({
  followup,
  profilesById,
}: {
  followup: RequestUpdateRecord;
  profilesById: Record<string, ProfileRecord | null | undefined>;
}) {
  const submittedBy = followup.created_by ? profilesById[followup.created_by] : null;

  return (
    <Card className="h-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Post-visit details</CardTitle>
        <CardDescription className="text-sm leading-6 text-zinc-400">
          The follow-up is shown in the same form language, but the fields stay locked.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-zinc-200">
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyField label="Diagnosis" value={String(followup.payload.diagnosis ?? "")} multiline className="md:col-span-2" />
          <ReadOnlyField
            label="Status(es) received"
            value={formatReportSickFollowupStatuses(
              (followup.payload as any).statusesReceived,
              Boolean((followup.payload as any).noStatusReceived ?? false),
            )}
            multiline
            className="md:col-span-2"
          />
          <ReadOnlyField label="Swab" value={String(followup.payload.swab ?? "")} />
          <ReadOnlyField label="SA-ART" value={String(followup.payload.saArt ?? "")} />
          <ReadOnlyField label="HA-ART" value={String(followup.payload.haArt ?? "")} />
          <ReadOnlyField label="PCR" value={String(followup.payload.pcr ?? "")} />
          <ReadOnlyField label="Nature" value={String(followup.payload.nature ?? "")} />
          <ReadOnlyField label="Safety" value={String(followup.payload.safety ?? "")} />
          <ReadOnlyField label="Category" value={String(followup.payload.category ?? "")} />
          <ReadOnlyField label="Medication" value={String(followup.payload.medication ?? "")} multiline className="md:col-span-2" />
          <ReadOnlyField label="Remarks" value={String(followup.payload.remarks ?? "")} multiline className="md:col-span-2" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-zinc-400">
          Submitted by {formatProfileName(submittedBy, followup.created_by_email)} at{" "}
          {formatDateTime(followup.created_at)}
        </div>
      </CardContent>
    </Card>
  );
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
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
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
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className={`mx-auto grid max-w-7xl gap-6 ${hasRightPane ? "xl:grid-cols-2" : ""}`}>
        <div className="animate-enter">
          {editableInitial ? (
            <RequestForm kind="report_sick" userEmail={user.email!} userId={user.id} initialRequest={request} />
          ) : request.kind === "report_sick" ? (
            <ReportSickInitialRequestCard request={request} profilesById={profilesById} />
          ) : (
            <RequestSummary request={request} profilesById={profilesById} />
          )}
        </div>

        {hasRightPane ? (
          <div className="grid gap-4 self-start xl:sticky xl:top-24">
            {canEditFollowup && !followup ? (
              <ReportSickFollowupForm request={request} initialUpdate={followup} />
            ) : followup ? (
              <PostVisitSummaryCard followup={followup} profilesById={profilesById} />
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
