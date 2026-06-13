"use client";

import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import type { ProfileRecord, ReportSickStatusEntry, ReportSickStatusType, RequestRecord, RequestUpdateRecord } from "@/lib/types";
import { formatProfileName } from "@/lib/profile-display";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalBanner } from "@/components/request/approval-banner";

const statusTypeOptions = [
  "MC",
  "Light Duty",
  "Excuse RMJ",
  "Excuse Heavy Load",
  "Excuse Upper Limb",
  "Excuse Lower Limb",
  "Excuse Uniform",
  "Excuse Boots",
  "Excuse Covered Footwear",
  "Excuse Camo",
] as const satisfies readonly ReportSickStatusType[];

type FollowupEntry = {
  days: number;
  type: ReportSickStatusType | "";
  startDate: string;
  endDate: string;
};

type FollowupPayloadLike = Record<string, unknown> & {
  diagnosis?: unknown;
  noStatusReceived?: unknown;
  statusesReceived?: unknown;
  swab?: unknown;
  saArt?: unknown;
  haArt?: unknown;
  pcr?: unknown;
  nature?: unknown;
  safety?: unknown;
  category?: unknown;
  medication?: unknown;
  remarks?: unknown;
};

function formatDateValue(value: string | null | undefined) {
  if (!value) return "";
  const parsed = parseISO(value);
  if (!isValid(parsed)) return value;
  return format(parsed, "dd MMM yyyy");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  return format(new Date(value), "dd MMM yyyy, HH:mm");
}

function isStatusType(value: unknown): value is ReportSickStatusType {
  return typeof value === "string" && (statusTypeOptions as readonly string[]).includes(value);
}

function emptyStatusEntry(): FollowupEntry {
  return {
    days: 1,
    type: "",
    startDate: "",
    endDate: "",
  };
}

function normalizeFollowupEntries(value: unknown): FollowupEntry[] {
  if (!Array.isArray(value) || !value.length) return [emptyStatusEntry()];

  return value.map((entry) => {
    if (!entry || typeof entry !== "object") return emptyStatusEntry();

    const typedEntry = entry as Partial<ReportSickStatusEntry>;
    return {
      days: Number(typedEntry.days) > 0 ? Number(typedEntry.days) : 1,
      type: isStatusType(typedEntry.type) ? typedEntry.type : "",
      startDate: typeof typedEntry.startDate === "string" ? typedEntry.startDate : "",
      endDate: typeof typedEntry.endDate === "string" ? typedEntry.endDate : "",
    };
  });
}

function ReadOnlyRadioField({
  name,
  label,
  value,
  options,
  layout = "wrap",
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  layout?: "row" | "wrap" | "grid";
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-[15px] font-medium leading-5 text-foreground">{label}</Label>
      <RadioGroup name={name} disabled value={value} onValueChange={() => {}} options={options} layout={layout} />
    </div>
  );
}

function FollowupStatusRow({ entry, idPrefix }: { entry: FollowupEntry; idPrefix: string }) {
  return (
    <div className="relative rounded-2xl border border-border bg-muted/40 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-days`} className="text-[15px] font-medium leading-5 text-foreground">
            Days
          </Label>
          <Input id={`${idPrefix}-days`} type="number" min={1} disabled value={entry.days} readOnly />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-type`} className="text-[15px] font-medium leading-5 text-foreground">
            Type
          </Label>
          <Select id={`${idPrefix}-type`} disabled value={entry.type} onChange={() => {}}>
            <option value="">Select type</option>
            {statusTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label className="text-[15px] font-medium leading-5 text-foreground">Start</Label>
          <Button type="button" variant="outline" className="w-full justify-start px-4 text-left font-normal" disabled>
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            {entry.startDate && isValid(parseISO(entry.startDate)) ? formatDateValue(entry.startDate) : "Select a date"}
          </Button>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-end`} className="text-[15px] font-medium leading-5 text-foreground">
            End (Auto)
          </Label>
          <Input id={`${idPrefix}-end`} value={formatDateValue(entry.endDate)} readOnly disabled />
        </div>
      </div>
    </div>
  );
}

export function ReportSickFollowupFields({
  payload,
  idPrefix = "report-sick-followup",
  className,
}: {
  payload: FollowupPayloadLike;
  idPrefix?: string;
  className?: string;
}) {
  const entries = normalizeFollowupEntries(payload.statusesReceived);
  const noStatusReceived = Boolean(payload.noStatusReceived ?? false);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-diagnosis`} className="text-[15px] font-medium leading-5 text-foreground">
          Diagnosis
        </Label>
        <Input
          id={`${idPrefix}-diagnosis`}
          placeholder="Diagnosis from medical provider"
          value={String(payload.diagnosis ?? "")}
          readOnly
          disabled
        />
      </div>

      <div className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label className="text-2xl font-semibold text-foreground">Status(es) Received</Label>
          <label className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <Checkbox checked={noStatusReceived} disabled />
            <span className="text-sm text-foreground">No status received</span>
          </label>
        </div>

        <div className="grid gap-4">
          {entries.map((entry, index) => (
            <FollowupStatusRow key={`${entry.startDate}-${entry.endDate}-${index}`} entry={entry} idPrefix={`${idPrefix}-status-${index}`} />
          ))}
        </div>

        <Button type="button" variant="outline" className="w-fit gap-2" disabled>
          <Plus className="h-4 w-4" />
          Add Status
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ReadOnlyRadioField
          name={`${idPrefix}-swab`}
          label="Swab"
          value={String(payload.swab ?? "")}
          options={[
            { value: "Yes", label: "Yes" },
            { value: "No", label: "No" },
          ]}
          layout="row"
        />
        <ReadOnlyRadioField
          name={`${idPrefix}-sa-art`}
          label="SA-ART"
          value={String(payload.saArt ?? "")}
          options={[
            { value: "Positive", label: "Positive" },
            { value: "Negative", label: "Negative" },
            { value: "NIL", label: "NIL" },
          ]}
        />
        <ReadOnlyRadioField
          name={`${idPrefix}-ha-art`}
          label="HA-ART"
          value={String(payload.haArt ?? "")}
          options={[
            { value: "Positive", label: "Positive" },
            { value: "Negative", label: "Negative" },
            { value: "NIL", label: "NIL" },
          ]}
        />
        <ReadOnlyRadioField
          name={`${idPrefix}-pcr`}
          label="PCR"
          value={String(payload.pcr ?? "")}
          options={[
            { value: "Positive", label: "Positive" },
            { value: "Negative", label: "Negative" },
            { value: "NIL", label: "NIL" },
          ]}
        />
        <ReadOnlyRadioField
          name={`${idPrefix}-nature`}
          label="Nature"
          value={String(payload.nature ?? "")}
          options={[
            { value: "Musculoskeletal Injury", label: "Musculoskeletal Injury" },
            { value: "Near Miss", label: "Near Miss" },
            { value: "Others", label: "Others" },
          ]}
          layout="grid"
        />
        <ReadOnlyRadioField
          name={`${idPrefix}-safety`}
          label="Safety"
          value={String(payload.safety ?? "")}
          options={[
            { value: "Safety", label: "Safety" },
            { value: "Non-safety", label: "Non-safety" },
          ]}
          layout="row"
        />
        <ReadOnlyRadioField
          name={`${idPrefix}-category`}
          label="Category"
          value={String(payload.category ?? "")}
          options={[
            { value: "ARI", label: "ARI" },
            { value: "Non-ARI", label: "Non-ARI" },
          ]}
          layout="row"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-medication`} className="text-[15px] font-medium leading-5 text-foreground">
          Medication
        </Label>
        <Input
          id={`${idPrefix}-medication`}
          placeholder="Medication prescribed, if any"
          value={String(payload.medication ?? "")}
          readOnly
          disabled
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-remarks`} className="text-[15px] font-medium leading-5 text-foreground">
          Remarks
        </Label>
        <Textarea
          id={`${idPrefix}-remarks`}
          placeholder="Additional details for the admin"
          value={String(payload.remarks ?? "")}
          readOnly
          disabled
        />
      </div>
    </div>
  );
}

export function ReportSickFollowupCard({
  request,
  followup,
  profilesById = {},
  className,
  headerClassName,
  contentClassName,
  idPrefix = "report-sick-followup",
}: {
  request?: RequestRecord;
  followup: RequestUpdateRecord;
  profilesById?: Record<string, ProfileRecord | null | undefined>;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  idPrefix?: string;
}) {
  const finalizedBy = request?.finalized_by ? profilesById[request.finalized_by] : null;

  return (
    <Card className={cn("h-full overflow-hidden", className)}>
      <CardHeader className={cn("space-y-2", headerClassName)}>
        <CardTitle className="text-2xl">Post-visit details</CardTitle>
      </CardHeader>
      <CardContent className={cn("space-y-6", contentClassName)}>
        <ReportSickFollowupFields payload={followup.payload} idPrefix={idPrefix} />
        {request?.finalized_at ? (
          <ApprovalBanner label="Finalized" name={formatProfileName(finalizedBy, request.finalized_by)} when={formatDateTime(request.finalized_at)} />
        ) : null}
      </CardContent>
    </Card>
  );
}
