import { format } from "date-fns";
import type { ProfileRecord, RequestRecord, RequestUpdateRecord } from "@/lib/types";
import { requestKindLabels } from "@/lib/request-meta";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/request/status-pill";
import { ApprovalBanner } from "@/components/request/approval-banner";
import { ReportSickFollowupFields } from "@/components/request/report-sick-followup-display";
import { cn } from "@/lib/utils";
import { formatProfileName } from "@/lib/profile-display";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  return format(new Date(value), "dd MMM yyyy, HH:mm");
}

function displayPerson(profile: ProfileRecord | null | undefined, fallback?: string | null) {
  return formatProfileName(profile, fallback);
}

export function ReadOnlyField({
  label,
  value,
  placeholder = "—",
  multiline = false,
  className,
}: {
  label: string;
  value: string | number | null | undefined;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}) {
  const displayValue = value === null || value === undefined || String(value).trim() === "" ? null : String(value);

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <div
        className={cn(
          "mt-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-foreground",
          multiline && "min-h-24",
          !displayValue && "text-muted-foreground",
        )}
      >
        <p className={cn(multiline && "whitespace-pre-wrap")}>{displayValue ?? placeholder}</p>
      </div>
    </div>
  );
}

function sectionTitle(title: string) {
  return (
    <div className="space-y-1">
      <p className="text-base font-semibold text-foreground">{title}</p>
    </div>
  );
}

export function RequestSummary({
  request,
  followup,
  profilesById = {},
  showLifecycle = true,
  showAdminNote = true,
}: {
  request: RequestRecord;
  followup?: RequestUpdateRecord | null;
  profilesById?: Record<string, ProfileRecord | null | undefined>;
  showLifecycle?: boolean;
  showAdminNote?: boolean;
}) {
  const approvedBy = request.approved_by ? profilesById[request.approved_by] : null;
  const rejectedBy = request.rejected_by ? profilesById[request.rejected_by] : null;
  const finalizedBy = request.finalized_by ? profilesById[request.finalized_by] : null;
  const followupSubmittedAt = request.followup_submitted_at ?? followup?.created_at ?? null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-4 p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-3">
            <Badge variant="outline" className="w-fit">
              {requestKindLabels[request.kind]}
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl">
                {request.kind === "report_sick" ? "Report sick request" : "External appointment request"}
              </CardTitle>
              <p className="text-base leading-7 text-muted-foreground">Submitted by {request.requester_email}</p>
            </div>
          </div>
          {request.kind === "report_sick" ? null : <StatusPill status={request.status} />}
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-8 pt-0">
        <section className="grid gap-4">
          {sectionTitle("Initial request")}
          <div className="grid gap-3 md:grid-cols-2">
            {request.kind === "report_sick" ? (
              <>
                <ReadOnlyField label="Date reporting sick" value={String((request.payload as any).dateReportingSick ?? "")} />
                <ReadOnlyField label="Time reporting sick" value={String((request.payload as any).timeReportingSick ?? "")} />
                <ReadOnlyField label="Where" value={String((request.payload as any).where ?? "")} />
                <ReadOnlyField label="Symptoms" value={String((request.payload as any).symptoms ?? "")} multiline className="md:col-span-2" />
                <ReadOnlyField
                  label="How did you contract it?"
                  value={String((request.payload as any).contractionSource ?? "")}
                  multiline
                  className="md:col-span-2"
                />
              </>
            ) : (
              <>
                <ReadOnlyField label="What" value={String((request.payload as any).what ?? "")} />
                <ReadOnlyField label="Where" value={String((request.payload as any).where ?? "")} />
                <ReadOnlyField label="When" value={String((request.payload as any).when ?? "")} />
                <ReadOnlyField label="Lessons missed" value={String((request.payload as any).lessonsMissed ?? "")} />
                <ReadOnlyField label="Why" value={String((request.payload as any).why ?? "")} multiline className="md:col-span-2" />
              </>
            )}
          </div>
        </section>

        {showLifecycle ? (
          <section className="grid gap-4">
            {sectionTitle("Lifecycle")}
            <div className="grid gap-3 md:grid-cols-2">
              <ReadOnlyField label="Submitted" value={formatDateTime(request.submitted_at ?? request.created_at)} />
              {request.rejected_at ? (
                <ReadOnlyField label="Rejected" value={`${displayPerson(rejectedBy, request.rejected_by)} · ${formatDateTime(request.rejected_at)}`} />
              ) : null}
              {followupSubmittedAt ? <ReadOnlyField label="Follow-up submitted" value={formatDateTime(followupSubmittedAt)} /> : null}
              {request.approved_at ? (
                <div className="md:col-span-2">
                  <ApprovalBanner
                    label="Approved"
                    name={displayPerson(approvedBy, request.approved_by)}
                    when={formatDateTime(request.approved_at)}
                  />
                </div>
              ) : null}
              {request.finalized_at ? (
                request.kind === "report_sick" && followup ? null : (
                  <div className="md:col-span-2">
                    <ApprovalBanner
                      label="Finalized"
                      name={displayPerson(finalizedBy, request.finalized_by)}
                      when={formatDateTime(request.finalized_at)}
                    />
                  </div>
                )
              ) : null}
            </div>
          </section>
        ) : null}

        {showAdminNote && request.review_note ? (
          <section className="grid gap-3">
            {sectionTitle("Admin note")}
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground">{request.review_note}</div>
          </section>
        ) : null}

        {request.kind === "report_sick" && followup ? (
          <section className="grid gap-4">
            {sectionTitle("Post-visit details")}
            <div className="grid gap-4">
              <ReportSickFollowupFields payload={followup.payload} idPrefix="summary-report-sick-followup" />
              {request.finalized_at ? (
                <ApprovalBanner
                  label="Finalized"
                  name={displayPerson(finalizedBy, request.finalized_by)}
                  when={formatDateTime(request.finalized_at)}
                />
              ) : null}
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
