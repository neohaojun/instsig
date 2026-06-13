"use client";

import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import type { RequestUpdateRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
] as const;

type FollowupEntry = {
  days: number;
  type: string;
  startDate: string;
  endDate: string;
};

function formatDateValue(value: string | null | undefined) {
  if (!value) return "";
  const parsed = parseISO(value);
  if (!isValid(parsed)) return value;
  return format(parsed, "dd MMM yyyy");
}

function normalizeFollowupEntries(value: unknown): FollowupEntry[] {
  if (!Array.isArray(value) || !value.length) {
    return [
      {
        days: 1,
        type: "",
        startDate: "",
        endDate: "",
      },
    ];
  }

  return value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return {
        days: 1,
        type: "",
        startDate: "",
        endDate: "",
      };
    }

    const typedEntry = entry as Partial<FollowupEntry>;
    return {
      days: Number(typedEntry.days) > 0 ? Number(typedEntry.days) : 1,
      type: typeof typedEntry.type === "string" ? typedEntry.type : "",
      startDate: typeof typedEntry.startDate === "string" ? typedEntry.startDate : "",
      endDate: typeof typedEntry.endDate === "string" ? typedEntry.endDate : "",
    };
  });
}

function FollowupStatusRow({ entry }: { entry: FollowupEntry }) {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-zinc-950/20 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label className="text-[15px] font-medium leading-5 text-zinc-100">Days</Label>
          <Input type="number" min={1} disabled value={entry.days} readOnly />
        </div>
        <div className="grid gap-2">
          <Label className="text-[15px] font-medium leading-5 text-zinc-100">Type</Label>
          <Select disabled value={entry.type} onChange={() => {}}>
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
          <Label className="text-[15px] font-medium leading-5 text-zinc-100">Start</Label>
          <Button type="button" variant="outline" className="w-full justify-start px-4 text-left font-normal" disabled>
            <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
            {entry.startDate && isValid(parseISO(entry.startDate)) ? formatDateValue(entry.startDate) : "Select a date"}
          </Button>
        </div>
        <div className="grid gap-2">
          <Label className="text-[15px] font-medium leading-5 text-zinc-100">End (Auto)</Label>
          <Input value={formatDateValue(entry.endDate)} readOnly disabled />
        </div>
      </div>
    </div>
  );
}

export function AdminReportSickFollowupCard({
  followup,
}: {
  followup: RequestUpdateRecord;
}) {
  const entries = normalizeFollowupEntries((followup.payload as any).statusesReceived);
  const noStatusReceived = Boolean((followup.payload as any).noStatusReceived ?? false);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2 p-8">
        <CardTitle className="text-2xl">Post-visit details</CardTitle>
        <CardDescription className="text-sm leading-6 text-zinc-400">
          The requester&apos;s doctor-visit details stay in the same read-only form treatment for review.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 pt-0">
        <div className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="diagnosis" className="text-[15px] font-medium leading-5 text-zinc-100">
              Diagnosis
            </Label>
            <Input id="diagnosis" placeholder="Diagnosis from medical provider" value={String(followup.payload.diagnosis ?? "")} readOnly disabled />
          </div>

          <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label className="text-2xl font-semibold text-zinc-100">Status(es) Received</Label>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <Checkbox checked={noStatusReceived} disabled />
                <span className="text-sm text-zinc-200">No status received</span>
              </label>
            </div>

            <div className="grid gap-4">
              {entries.map((entry, index) => (
                <FollowupStatusRow key={`${entry.startDate}-${index}`} entry={entry} />
              ))}
            </div>

            <Button type="button" variant="outline" className="w-fit gap-2" disabled>
              <Plus className="h-4 w-4" />
              Add Status
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label className="text-[15px] font-medium leading-5 text-zinc-100">Swab</Label>
              <RadioGroup
                name="swab"
                disabled
                value={String(followup.payload.swab ?? "")}
                onValueChange={() => {}}
                options={[
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No" },
                ]}
                layout="row"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-[15px] font-medium leading-5 text-zinc-100">SA-ART</Label>
              <RadioGroup
                name="saArt"
                disabled
                value={String(followup.payload.saArt ?? "")}
                onValueChange={() => {}}
                options={[
                  { value: "Positive", label: "Positive" },
                  { value: "Negative", label: "Negative" },
                  { value: "NIL", label: "NIL" },
                ]}
                layout="wrap"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-[15px] font-medium leading-5 text-zinc-100">HA-ART</Label>
              <RadioGroup
                name="haArt"
                disabled
                value={String(followup.payload.haArt ?? "")}
                onValueChange={() => {}}
                options={[
                  { value: "Positive", label: "Positive" },
                  { value: "Negative", label: "Negative" },
                  { value: "NIL", label: "NIL" },
                ]}
                layout="wrap"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-[15px] font-medium leading-5 text-zinc-100">PCR</Label>
              <RadioGroup
                name="pcr"
                disabled
                value={String(followup.payload.pcr ?? "")}
                onValueChange={() => {}}
                options={[
                  { value: "Positive", label: "Positive" },
                  { value: "Negative", label: "Negative" },
                  { value: "NIL", label: "NIL" },
                ]}
                layout="wrap"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-[15px] font-medium leading-5 text-zinc-100">Nature</Label>
              <RadioGroup
                name="nature"
                disabled
                value={String(followup.payload.nature ?? "")}
                onValueChange={() => {}}
                options={[
                  { value: "Musculoskeletal Injury", label: "Musculoskeletal Injury" },
                  { value: "Near Miss", label: "Near Miss" },
                  { value: "Others", label: "Others" },
                ]}
                layout="grid"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-[15px] font-medium leading-5 text-zinc-100">Safety</Label>
              <RadioGroup
                name="safety"
                disabled
                value={String(followup.payload.safety ?? "")}
                onValueChange={() => {}}
                options={[
                  { value: "Safety", label: "Safety" },
                  { value: "Non-safety", label: "Non-safety" },
                ]}
                layout="row"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-[15px] font-medium leading-5 text-zinc-100">Category</Label>
              <RadioGroup
                name="category"
                disabled
                value={String(followup.payload.category ?? "")}
                onValueChange={() => {}}
                options={[
                  { value: "ARI", label: "ARI" },
                  { value: "Non-ARI", label: "Non-ARI" },
                ]}
                layout="row"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="medication" className="text-[15px] font-medium leading-5 text-zinc-100">
              Medication
            </Label>
            <Input id="medication" placeholder="Medication prescribed, if any" value={String(followup.payload.medication ?? "")} readOnly disabled />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="remarks" className="text-[15px] font-medium leading-5 text-zinc-100">
              Remarks
            </Label>
            <Textarea id="remarks" placeholder="Additional details for the admin" value={String(followup.payload.remarks ?? "")} readOnly disabled />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
