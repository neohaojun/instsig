"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { addDays, format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Plus, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ProfileRecord, ReportSickFollowupPayload, ReportSickStatusEntry, ReportSickStatusType, RequestRecord, RequestUpdateRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalBanner } from "@/components/request/approval-banner";
import { cn } from "@/lib/utils";
import { formatProfileName } from "@/lib/profile-display";

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

const statusTypeSchema = z
  .string()
  .min(1, "Select a type")
  .refine((value): value is ReportSickStatusType => statusTypeOptions.includes(value as ReportSickStatusType), {
    message: "Select a type",
  });

const statusEntrySchema = z.object({
  days: z.coerce.number().int().min(1, "Days must be at least 1"),
  type: statusTypeSchema,
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

const followupSchema = z
  .object({
    diagnosis: z.string().min(1, "Diagnosis is required"),
    noStatusReceived: z.boolean().default(false),
    statusesReceived: z.array(statusEntrySchema).default([]),
    swab: z.enum(["Yes", "No"]),
    saArt: z.enum(["Positive", "Negative", "NIL"]),
    haArt: z.enum(["Positive", "Negative", "NIL"]),
    pcr: z.enum(["Positive", "Negative", "NIL"]),
    nature: z.enum(["Musculoskeletal Injury", "Near Miss", "Others"]),
    safety: z.enum(["Safety", "Non-safety"]),
    category: z.enum(["ARI", "Non-ARI"]),
    medication: z.string().min(1, "Medication is required"),
    remarks: z.string().optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (!data.noStatusReceived && data.statusesReceived.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["statusesReceived"],
        message: "Add at least one status entry or mark no status received.",
      });
    }
  });

type FollowupValues = Omit<z.infer<typeof followupSchema>, "statusesReceived"> & {
  statusesReceived: StatusEntryValues[];
};
type StatusEntryValues = {
  days: number;
  type: ReportSickStatusType | "";
  startDate: string;
  endDate: string;
};

function firstErrorMessage(errors: unknown): string | null {
  if (!errors || typeof errors !== "object") return null;
  for (const value of Object.values(errors as Record<string, unknown>)) {
    if (!value) continue;
    if (typeof value === "object" && value && "message" in value) {
      const message = (value as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    const nested = firstErrorMessage(value);
    if (nested) return nested;
  }
  return null;
}

type SupabaseErrorSummary = {
  code: string | null;
  message: string | null;
  details: string | null;
  hint: string | null;
  name: string | null;
};

function normalizeSupabaseError(error: unknown): SupabaseErrorSummary {
  if (!error || typeof error !== "object") {
    return {
      code: null,
      message: null,
      details: null,
      hint: null,
      name: null,
    };
  }

  const typedError = error as Record<string, unknown>;

  return {
    code: typeof typedError.code === "string" ? typedError.code : null,
    message: typeof typedError.message === "string" ? typedError.message : null,
    details: typeof typedError.details === "string" ? typedError.details : null,
    hint: typeof typedError.hint === "string" ? typedError.hint : null,
    name: typeof typedError.name === "string" ? typedError.name : null,
  };
}

function isMissingRpcError(error: SupabaseErrorSummary) {
  const combinedText = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  return error.code === "PGRST202" || (combinedText.includes("submit_report_sick_followup") && combinedText.includes("Could not find"));
}

function isMissingFollowupSchemaError(error: SupabaseErrorSummary) {
  const combinedText = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  return combinedText.includes("request_updates") && combinedText.includes("Could not find");
}

function hasSupabaseError(error: SupabaseErrorSummary | null) {
  return Boolean(error?.message || error?.code || error?.details || error?.hint);
}

function createSupabaseErrorSummary(partial: Partial<SupabaseErrorSummary>): SupabaseErrorSummary {
  return {
    code: partial.code ?? null,
    message: partial.message ?? null,
    details: partial.details ?? null,
    hint: partial.hint ?? null,
    name: partial.name ?? null,
  };
}

function displayPerson(profile: ProfileRecord | null | undefined, fallback?: string | null) {
  return formatProfileName(profile, fallback);
}

function createEmptyStatusEntry(): StatusEntryValues {
  return {
    days: 1,
    type: "",
    startDate: "",
    endDate: "",
  };
}

function isStatusType(value: unknown): value is ReportSickStatusType {
  return typeof value === "string" && (statusTypeOptions as readonly string[]).includes(value);
}

function normalizeStatusEntries(value: unknown): StatusEntryValues[] {
  if (!Array.isArray(value) || !value.length) {
    return [createEmptyStatusEntry()];
  }

  return value.map((entry) => {
    if (!entry || typeof entry !== "object") return createEmptyStatusEntry();
    const typedEntry = entry as Partial<StatusEntryValues>;
    return {
      days: Number(typedEntry.days) > 0 ? Number(typedEntry.days) : 1,
      type: isStatusType(typedEntry.type) ? typedEntry.type : "",
      startDate: typeof typedEntry.startDate === "string" ? typedEntry.startDate : "",
      endDate: typeof typedEntry.endDate === "string" ? typedEntry.endDate : "",
    };
  });
}

function formatDateValue(value: string) {
  if (!value) return "";
  const parsed = parseISO(value);
  if (!isValid(parsed)) return value;
  return format(parsed, "dd MMM yyyy");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  return format(new Date(value), "dd MMM yyyy, HH:mm");
}

function computeEndDate(startDate: string, days: number) {
  if (!startDate || days < 1) return "";
  const parsed = parseISO(startDate);
  if (!isValid(parsed)) return "";
  return format(addDays(parsed, Math.max(1, days) - 1), "yyyy-MM-dd");
}

function RadioField({
  control,
  name,
  label,
  options,
  layout = "wrap",
  disabled,
  className,
}: {
  control: any;
  name: keyof FollowupValues;
  label: string;
  options: { value: string; label: string }[];
  layout?: "row" | "wrap" | "grid";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={String(name)} className="text-[15px] font-medium leading-5 text-foreground">
        {label}
      </Label>
      <Controller
        control={control}
        name={name as any}
        render={({ field }) => (
          <RadioGroup
            name={field.name}
            value={String(field.value ?? "")}
            onValueChange={field.onChange}
            options={options}
            layout={layout}
            disabled={disabled}
          />
        )}
      />
    </div>
  );
}

export function ReportSickInitialRequestCard({
  request,
  profilesById = {},
}: {
  request: RequestRecord;
  profilesById?: Record<string, ProfileRecord | null | undefined>;
}) {
  const payload = request.payload as Record<string, unknown>;
  const selectedDate = typeof payload.dateReportingSick === "string" ? parseISO(payload.dateReportingSick) : undefined;
  const approvedBy = request.approved_by ? profilesById[request.approved_by] : null;

  return (
    <Card className="mx-auto w-full max-w-5xl">
      <CardHeader>
        <CardTitle>Request Form (Read-Only)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="dateReportingSick">Date Reporting Sick</Label>
            <Button type="button" variant="outline" className="w-full justify-start px-4 text-left font-normal" disabled>
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {selectedDate && isValid(selectedDate) ? format(selectedDate, "dd MMM yyyy") : "Select a date"}
            </Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="timeReportingSick">Time Reporting Sick</Label>
            <Input
              id="timeReportingSick"
              type="time"
              className="text-left"
              value={String(payload.timeReportingSick ?? "")}
              readOnly
              disabled
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="where">Where are you reporting sick?</Label>
            <Input id="where" value={String(payload.where ?? "")} placeholder="Clinic / hospital / home" readOnly disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="symptoms">What symptoms are you currently experiencing?</Label>
            <Textarea id="symptoms" value={String(payload.symptoms ?? "")} placeholder="Describe your symptoms" readOnly disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contractionSource">How did you contract these symptoms?</Label>
            <Textarea
              id="contractionSource"
              value={String(payload.contractionSource ?? "")}
              placeholder="Describe the likely source or cause"
              readOnly
              disabled
            />
          </div>
          {request.approved_at ? (
            <ApprovalBanner label="Approved" name={displayPerson(approvedBy, request.approved_by)} when={formatDateTime(request.approved_at)} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusEntryRow({
  control,
  index,
  onRemove,
  canRemove,
  disabled,
  setValue,
}: {
  control: any;
  index: number;
  onRemove: () => void;
  canRemove: boolean;
  disabled: boolean;
  setValue: any;
}) {
  const [startOpen, setStartOpen] = useState(false);
  const days = useWatch({ control, name: `statusesReceived.${index}.days` }) as number | undefined;
  const startDate = useWatch({ control, name: `statusesReceived.${index}.startDate` }) as string | undefined;
  const endDate = useWatch({ control, name: `statusesReceived.${index}.endDate` }) as string | undefined;
  const selectedDate = startDate ? parseISO(startDate) : undefined;

  useEffect(() => {
    const nextEndDate = computeEndDate(startDate ?? "", Number(days ?? 1));
    if (nextEndDate !== (endDate ?? "")) {
      setValue(`statusesReceived.${index}.endDate`, nextEndDate, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  }, [days, endDate, index, setValue, startDate]);

  return (
    <div className="relative rounded-2xl border border-border bg-muted/40 p-4">
      {canRemove ? (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute right-4 top-4 h-11 w-11 rounded-2xl"
          onClick={onRemove}
          disabled={disabled}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`statusesReceived.${index}.days`} className="text-[15px] font-medium leading-5 text-foreground">
            Days
          </Label>
          <Controller
            control={control}
            name={`statusesReceived.${index}.days`}
            render={({ field }) => (
              <Input
                id={`statusesReceived.${index}.days`}
                type="number"
                min={1}
                disabled={disabled}
                value={field.value ?? 1}
                onChange={(event) => field.onChange(event.target.valueAsNumber || 1)}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            )}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`statusesReceived.${index}.type`} className="text-[15px] font-medium leading-5 text-foreground">
            Type
          </Label>
          <Controller
            control={control}
            name={`statusesReceived.${index}.type`}
            render={({ field }) => (
              <Select id={`statusesReceived.${index}.type`} disabled={disabled} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref}>
                <option value="">Select type</option>
                {statusTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            )}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`statusesReceived.${index}.startDate`} className="text-[15px] font-medium leading-5 text-foreground">
            Start
          </Label>
          <Controller
            control={control}
            name={`statusesReceived.${index}.startDate`}
            render={({ field }) => {
              const fieldDate = field.value ? parseISO(field.value) : undefined;
              return (
                <Popover open={startOpen} onOpenChange={setStartOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start px-4 text-left font-normal" disabled={disabled}>
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {fieldDate && isValid(fieldDate) ? format(fieldDate, "dd MMM yyyy") : "Select a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full max-w-[20rem] p-4" align="start">
                    <Calendar
                      selected={fieldDate && isValid(fieldDate) ? fieldDate : undefined}
                      onSelect={(date) => {
                        field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                        if (date) setStartOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              );
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`statusesReceived.${index}.endDate`} className="text-[15px] font-medium leading-5 text-foreground">
            End (Auto)
          </Label>
          <Input id={`statusesReceived.${index}.endDate`} value={formatDateValue(endDate ?? "")} readOnly disabled />
        </div>
      </div>
    </div>
  );
}

export function ReportSickFollowupForm({
  request,
  initialUpdate,
}: {
  request: RequestRecord;
  initialUpdate?: RequestUpdateRecord | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [banner, setBanner] = useState<string | null>(null);
  const fieldLabelClassName = "text-[15px] font-medium leading-5 text-foreground";

  const defaultValues: FollowupValues = {
    diagnosis: "",
    noStatusReceived: false,
    statusesReceived: [createEmptyStatusEntry()],
    swab: "No",
    saArt: "NIL",
    haArt: "NIL",
    pcr: "NIL",
    nature: "Others",
    safety: "Non-safety",
    category: "Non-ARI",
    medication: "",
    remarks: "",
  };

  const form = useForm<FollowupValues>({
    resolver: zodResolver(followupSchema),
    defaultValues: initialUpdate?.payload
      ? ({
        diagnosis: String(initialUpdate.payload.diagnosis ?? ""),
        noStatusReceived: Boolean((initialUpdate.payload as any).noStatusReceived ?? false),
        statusesReceived: normalizeStatusEntries((initialUpdate.payload as any).statusesReceived),
        swab: (initialUpdate.payload.swab as FollowupValues["swab"]) ?? "No",
        saArt: (initialUpdate.payload.saArt as FollowupValues["saArt"]) ?? "NIL",
        haArt: (initialUpdate.payload.haArt as FollowupValues["haArt"]) ?? "NIL",
        pcr: (initialUpdate.payload.pcr as FollowupValues["pcr"]) ?? "NIL",
        nature: (initialUpdate.payload.nature as FollowupValues["nature"]) ?? "Others",
        safety: (initialUpdate.payload.safety as FollowupValues["safety"]) ?? "Non-safety",
        category: (initialUpdate.payload.category as FollowupValues["category"]) ?? "Non-ARI",
        medication: String(initialUpdate.payload.medication ?? ""),
        remarks: String(initialUpdate.payload.remarks ?? ""),
      } as FollowupValues)
      : defaultValues,
  });

  const statusFields = useFieldArray({
    control: form.control,
    name: "statusesReceived",
  });

  const noStatusReceived = useWatch({ control: form.control, name: "noStatusReceived" });

  useEffect(() => {
    if (initialUpdate?.payload) {
      form.reset({
        diagnosis: String(initialUpdate.payload.diagnosis ?? ""),
        noStatusReceived: Boolean((initialUpdate.payload as any).noStatusReceived ?? false),
        statusesReceived: normalizeStatusEntries((initialUpdate.payload as any).statusesReceived),
        swab: (initialUpdate.payload.swab as FollowupValues["swab"]) ?? "No",
        saArt: (initialUpdate.payload.saArt as FollowupValues["saArt"]) ?? "NIL",
        haArt: (initialUpdate.payload.haArt as FollowupValues["haArt"]) ?? "NIL",
        pcr: (initialUpdate.payload.pcr as FollowupValues["pcr"]) ?? "NIL",
        nature: (initialUpdate.payload.nature as FollowupValues["nature"]) ?? "Others",
        safety: (initialUpdate.payload.safety as FollowupValues["safety"]) ?? "Non-safety",
        category: (initialUpdate.payload.category as FollowupValues["category"]) ?? "Non-ARI",
        medication: String(initialUpdate.payload.medication ?? ""),
        remarks: String(initialUpdate.payload.remarks ?? ""),
      });
    }
  }, [form, initialUpdate]);

  async function onSubmit(values: FollowupValues) {
    setBanner(null);

    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setBanner("We couldn't verify your session. Please sign in again.");
        return;
      }

      const payload: ReportSickFollowupPayload = {
        diagnosis: values.diagnosis,
        noStatusReceived: values.noStatusReceived,
        statusesReceived: values.noStatusReceived
          ? []
          : values.statusesReceived.map((entry) => ({
            days: Number(entry.days),
            type: entry.type as ReportSickStatusType,
            startDate: entry.startDate,
            endDate: entry.endDate,
          })),
        swab: values.swab,
        saArt: values.saArt,
        haArt: values.haArt,
        pcr: values.pcr,
        nature: values.nature,
        safety: values.safety,
        category: values.category,
        medication: values.medication,
        remarks: values.remarks ?? "",
      };

      let followupErrorSummary: SupabaseErrorSummary | null = null;
      const submittedAt = new Date().toISOString();

      const { error: upsertError } = await supabase.from("request_updates").upsert(
        {
          request_id: request.id,
          kind: "doctor_followup",
          payload,
          created_by: user.id,
          created_by_email: user.email,
        },
        { onConflict: "request_id,kind" },
      );

      const upsertErrorSummary = normalizeSupabaseError(upsertError);

      if (hasSupabaseError(upsertErrorSummary)) {
        if (isMissingFollowupSchemaError(upsertErrorSummary)) {
          const { error: rpcError } = await supabase.rpc("submit_report_sick_followup", {
            p_payload: payload,
            p_request_id: request.id,
          });

          followupErrorSummary = normalizeSupabaseError(rpcError);
        } else {
          followupErrorSummary = upsertErrorSummary;
        }
      } else {
        const { data: updatedRequests, error: requestUpdateError } = await supabase
          .from("requests")
          .update({
            status: "submitted",
            followup_submitted_at: submittedAt,
            updated_at: submittedAt,
          })
          .eq("id", request.id)
          .eq("status", "approved")
          .select("id");

        const requestUpdateErrorSummary = normalizeSupabaseError(requestUpdateError);

        if (hasSupabaseError(requestUpdateErrorSummary)) {
          const { error: rpcError } = await supabase.rpc("submit_report_sick_followup", {
            p_payload: payload,
            p_request_id: request.id,
          });

          followupErrorSummary = normalizeSupabaseError(rpcError);
        } else if (!updatedRequests?.length) {
          const { error: rpcError } = await supabase.rpc("submit_report_sick_followup", {
            p_payload: payload,
            p_request_id: request.id,
          });

          const rpcErrorSummary = normalizeSupabaseError(rpcError);
          followupErrorSummary = hasSupabaseError(rpcErrorSummary)
            ? rpcErrorSummary
            : createSupabaseErrorSummary({
              code: "FOLLOWUP_STATUS_NOT_UPDATED",
              message: "The request follow-up row saved, but the follow-up timestamp could not be updated.",
            });
        }
      }

      if (hasSupabaseError(followupErrorSummary)) {
        const errorSummary = followupErrorSummary ?? createSupabaseErrorSummary({
          code: "UNKNOWN_FOLLOWUP_ERROR",
          message: "Unknown follow-up submission error.",
        });
        console.warn("Failed to submit report sick follow-up", followupErrorSummary);
        setBanner(
          isMissingFollowupSchemaError(errorSummary)
            ? "We couldn't save the post-visit details because the follow-up database setup is incomplete. Please apply the latest Supabase schema, then try again."
            : "We couldn't save the post-visit details right now. Please try again.",
        );
        return;
      }

      router.refresh();
      router.back();
    });
  }

  return (
    <Card className="mx-auto w-full max-w-5xl">
      <CardHeader className="space-y-2">
        <CardTitle>Post-visit details</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(onSubmit, (errors) => {
            setBanner(firstErrorMessage(errors) ?? "Please fix the highlighted fields.");
          })}
        >
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="diagnosis" className={fieldLabelClassName}>
                Diagnosis
              </Label>
              <Input id="diagnosis" placeholder="Diagnosis from medical provider" {...form.register("diagnosis")} />
            </div>

            <div className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Label className="text-2xl font-semibold text-foreground">Status(es) Received</Label>
                <label className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
                  <Checkbox {...form.register("noStatusReceived")} />
                  <span className="text-sm text-foreground">No status received</span>
                </label>
              </div>

              <div className="grid gap-4">
                {statusFields.fields.map((field, index) => (
                  <StatusEntryRow
                    key={field.id}
                    control={form.control}
                    index={index}
                    onRemove={() => statusFields.remove(index)}
                    canRemove={statusFields.fields.length > 1}
                    disabled={Boolean(noStatusReceived)}
                    setValue={form.setValue}
                  />
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-fit gap-2"
                onClick={() => statusFields.append(createEmptyStatusEntry())}
                disabled={Boolean(noStatusReceived)}
              >
                <Plus className="h-4 w-4" />
                Add Status
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <RadioField
                control={form.control}
                name="swab"
                label="Swab"
                options={[
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No" },
                ]}
                layout="row"
              />

              <RadioField
                control={form.control}
                name="saArt"
                label="SA-ART"
                options={[
                  { value: "Positive", label: "Positive" },
                  { value: "Negative", label: "Negative" },
                  { value: "NIL", label: "NIL" },
                ]}
                layout="wrap"
              />

              <RadioField
                control={form.control}
                name="haArt"
                label="HA-ART"
                options={[
                  { value: "Positive", label: "Positive" },
                  { value: "Negative", label: "Negative" },
                  { value: "NIL", label: "NIL" },
                ]}
                layout="wrap"
              />

              <RadioField
                control={form.control}
                name="pcr"
                label="PCR"
                options={[
                  { value: "Positive", label: "Positive" },
                  { value: "Negative", label: "Negative" },
                  { value: "NIL", label: "NIL" },
                ]}
                layout="wrap"
              />

              <RadioField
                control={form.control}
                name="nature"
                label="Nature"
                options={[
                  { value: "Musculoskeletal Injury", label: "Musculoskeletal Injury" },
                  { value: "Near Miss", label: "Near Miss" },
                  { value: "Others", label: "Others" },
                ]}
                layout="grid"
              />

              <RadioField
                control={form.control}
                name="safety"
                label="Safety"
                options={[
                  { value: "Safety", label: "Safety" },
                  { value: "Non-safety", label: "Non-safety" },
                ]}
                layout="row"
              />

              <RadioField
                control={form.control}
                name="category"
                label="Category"
                options={[
                  { value: "ARI", label: "ARI" },
                  { value: "Non-ARI", label: "Non-ARI" },
                ]}
                layout="row"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="medication" className={fieldLabelClassName}>
                Medication
              </Label>
              <Input id="medication" placeholder="Medication prescribed, if any" {...form.register("medication")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remarks" className={fieldLabelClassName}>
                Remarks
              </Label>
              <Textarea id="remarks" placeholder="Additional details for the admin" {...form.register("remarks")} />
            </div>
          </div>

          {banner ? <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">{banner}</p> : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Close
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : initialUpdate ? "Update Follow-Up" : "Submit Follow-Up"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
