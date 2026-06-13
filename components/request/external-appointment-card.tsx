import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { ProfileRecord, RequestRecord } from "@/lib/types";
import { formatProfileName } from "@/lib/profile-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalBanner } from "@/components/request/approval-banner";
import { cn } from "@/lib/utils";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  return format(new Date(value), "dd MMM yyyy, HH:mm");
}

function formatAppointmentWhen(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const parsed = parseISO(value);
  if (!isValid(parsed)) return value;
  return format(parsed, "dd MMM yyyy, HH:mm");
}

function displayPerson(profile: ProfileRecord | null | undefined, fallback?: string | null) {
  return formatProfileName(profile, fallback);
}

function ReviewBanner({
  label,
  name,
  when,
}: {
  label: "Approved" | "Rejected";
  name: string;
  when: string;
}) {
  if (label === "Approved") {
    return <ApprovalBanner label={label} name={name} when={when} />;
  }

  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-950/15 px-5 py-4 text-red-200 shadow-[inset_0_1px_0_rgba(248,113,113,0.1)]">
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-7 text-red-200">
          Rejected by {name}
        </p>
        <p className="mt-1 text-sm font-medium text-red-300">on {when}</p>
      </div>
    </div>
  );
}

export function ExternalAppointmentRequestCard({
  request,
  profilesById = {},
  className,
}: {
  request: RequestRecord;
  profilesById?: Record<string, ProfileRecord | null | undefined>;
  className?: string;
}) {
  const payload = request.payload as Record<string, unknown>;
  const approvedBy = request.approved_by ? profilesById[request.approved_by] : null;
  const rejectedBy = request.rejected_by ? profilesById[request.rejected_by] : null;

  return (
    <Card className={cn("mx-auto w-full max-w-5xl", className)}>
      <CardHeader>
        <CardTitle>External appointment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="external-appointment-what">What</Label>
            <Input
              id="external-appointment-what"
              value={String(payload.what ?? "")}
              placeholder="Appointment purpose"
              readOnly
              disabled
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="external-appointment-where">Where</Label>
            <Input
              id="external-appointment-where"
              value={String(payload.where ?? "")}
              placeholder="Location"
              readOnly
              disabled
            />
          </div>
          <div className="grid gap-2">
            <Label>When</Label>
            <Button type="button" variant="outline" className="w-full justify-start px-4 text-left font-normal" disabled>
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {formatAppointmentWhen(payload.when) || "Select a date and time"}
            </Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="external-appointment-lessons">Lessons missed</Label>
            <Input
              id="external-appointment-lessons"
              value={String(payload.lessonsMissed ?? "")}
              placeholder="PT, Weapons Training, etc."
              readOnly
              disabled
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="external-appointment-why">Why</Label>
            <Textarea
              id="external-appointment-why"
              value={String(payload.why ?? "")}
              placeholder="Background / reason"
              readOnly
              disabled
            />
          </div>
          {request.approved_at ? (
            <ReviewBanner
              label="Approved"
              name={displayPerson(approvedBy, request.approved_by)}
              when={formatDateTime(request.approved_at)}
            />
          ) : null}
          {request.rejected_at ? (
            <ReviewBanner
              label="Rejected"
              name={displayPerson(rejectedBy, request.rejected_by)}
              when={formatDateTime(request.rejected_at)}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
