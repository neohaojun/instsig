"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon, ImageIcon, Upload } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ExternalAppointmentPayload, ReportSickPayload, RequestKind, RequestRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { formatDisplayDate } from "@/lib/display-date";

const reportSickSchema = z.object({
  dateReportingSick: z.string().min(1, "Date reporting sick is required"),
  timeReportingSick: z.string().min(1, "Time reporting sick is required"),
  where: z.string().min(1, "Where is required"),
  symptoms: z.string().min(1, "Symptoms are required"),
  contractionSource: z.string().min(1, "Source is required"),
});

const externalAppointmentSchema = z.object({
  what: z.string().min(1, "Appointment description is required"),
  where: z.string().min(1, "Location is required"),
  when: z.string().min(1, "Date and time is required").refine((value) => {
    const [date = "", time = ""] = value.split("T");
    return Boolean(date && time);
  }, {
    message: "Date and time is required",
  }),
  lessonsMissed: z.string().min(1, "Lessons missed is required"),
  why: z.string().min(1, "Reason is required"),
});

const maxProofBytes = 10 * 1024 * 1024;
const acceptedProofTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("invalid-file"));
    reader.onerror = () => reject(reader.error ?? new Error("file-read-failed"));
    reader.readAsDataURL(file);
  });
}

type FormValues = z.infer<typeof reportSickSchema> | z.infer<typeof externalAppointmentSchema>;

const kindFormMeta: Record<RequestKind, { title: string }> = {
  report_sick: {
    title: "Report Sick",
  },
  external_appointment: {
    title: "External Appointment",
  },
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

export function RequestForm({
  kind,
  userEmail,
  userId,
  unitId,
  initialRequest,
  requestId: requestIdProp,
  onClose,
  onSaved,
  editMode = "requester",
  actorId,
  actorEmail,
  submittedOnBehalf = false,
}: {
  kind: RequestKind;
  userEmail: string;
  userId: string;
  unitId?: string | null;
  initialRequest?: RequestRecord | null;
  requestId?: string | null;
  onClose?: () => void;
  onSaved?: (request: RequestRecord) => void;
  editMode?: "requester" | "admin";
  actorId?: string;
  actorEmail?: string;
  submittedOnBehalf?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = requestIdProp !== undefined ? requestIdProp : searchParams.get("id");
  const [pending, startTransition] = useTransition();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [banner, setBanner] = useState<string | null>(null);
  const [appointmentProof, setAppointmentProof] = useState<File | null>(null);

  const defaultReportSick: z.infer<typeof reportSickSchema> = {
    dateReportingSick: "",
    timeReportingSick: "",
    where: "",
    symptoms: "",
    contractionSource: "",
  };

  const defaultExternal: z.infer<typeof externalAppointmentSchema> = {
    what: "",
    where: "",
    when: "",
    lessonsMissed: "",
    why: "",
  };

  const form = useForm<any>({
    resolver: zodResolver(kind === "report_sick" ? reportSickSchema : externalAppointmentSchema),
    defaultValues:
      initialRequest && initialRequest.kind === kind
        ? (initialRequest.payload as any)
        : kind === "report_sick"
          ? defaultReportSick
          : defaultExternal,
  });

  useEffect(() => {
    if (initialRequest && initialRequest.kind === kind) {
      form.reset(initialRequest.payload as any);
    }
  }, [form, initialRequest, kind]);

  async function onSubmit(values: FormValues) {
    setBanner(null);
    const payload = values;
    const payloadRecord = kind === "external_appointment"
      ? {
        ...((initialRequest?.kind === "external_appointment" ? initialRequest.payload : {}) as Partial<ExternalAppointmentPayload>),
        ...(payload as ExternalAppointmentPayload),
      }
      : payload as ReportSickPayload;

    startTransition(async () => {
      const timestamp = new Date().toISOString();
      let requestUnitId = unitId ?? initialRequest?.unit_id ?? null;
      if (!requestId && !requestUnitId) {
        const { data: requesterProfile, error: profileError } = await supabase
          .from("profiles")
          .select("unit_id")
          .eq("id", userId)
          .single();
        if (profileError || !requesterProfile?.unit_id) {
          console.error("Failed to resolve request unit", profileError);
          setBanner("Your unit assignment is missing. Please contact an administrator.");
          return;
        }
        requestUnitId = requesterProfile.unit_id;
      }
      const result = editMode === "admin" && initialRequest && requestId
        ? await supabase
          .from("requests")
          .update({ payload: payloadRecord, updated_at: timestamp })
          .eq("id", requestId)
          .select()
          .single()
        : requestId
          ? await supabase
            .from("requests")
            .update({
              kind,
              requester_id: userId,
              requester_email: userEmail,
              payload: payloadRecord,
              status: "pending" as const,
              updated_at: timestamp,
              submitted_at: timestamp,
            })
            .eq("id", requestId)
            .select()
            .single()
          : await supabase
            .from("requests")
            .insert({
              unit_id: requestUnitId,
              kind,
              requester_id: userId,
              requester_email: userEmail,
              payload: payloadRecord,
              status: "pending" as const,
              updated_at: timestamp,
              submitted_at: timestamp,
            })
            .select()
            .single();

      if (result.error) {
        console.error("Failed to save request", result.error);
        setBanner("We couldn't save this request right now. Please try again.");
        return;
      }

      if (kind === "external_appointment" && appointmentProof) {
        const savedPayload = { ...(result.data.payload as ExternalAppointmentPayload) };
        const attachmentData = new FormData();
        attachmentData.set("requestId", result.data.id);
        attachmentData.set("purpose", "external-appointment");
        attachmentData.set("file", appointmentProof);

        try {
          const response = await fetch("/api/request-attachments", { method: "POST", body: attachmentData });
          const uploaded = await response.json().catch(() => null) as { path?: string; name?: string } | null;
          if (response.ok && uploaded?.path) {
            savedPayload.proofPath = uploaded.path;
            savedPayload.proofName = uploaded.name ?? appointmentProof.name;
            savedPayload.proofDataUrl = undefined;
          } else {
            savedPayload.proofPath = undefined;
            savedPayload.proofName = appointmentProof.name;
            savedPayload.proofDataUrl = await readFileAsDataUrl(appointmentProof);
          }
        } catch (error) {
          console.warn("Appointment proof storage unavailable; saving it with the request", error);
          try {
            savedPayload.proofPath = undefined;
            savedPayload.proofName = appointmentProof.name;
            savedPayload.proofDataUrl = await readFileAsDataUrl(appointmentProof);
          } catch (readError) {
            console.error("Failed to prepare appointment proof", readError);
            setBanner("The request was saved, but the photo could not be attached. Please choose it again.");
            return;
          }
        }

        const attachmentResult = await supabase
          .from("requests")
          .update({ payload: savedPayload, updated_at: timestamp })
          .eq("id", result.data.id)
          .select()
          .single();
        if (attachmentResult.error) {
          console.error("Failed to save appointment proof", attachmentResult.error);
          setBanner("The request was saved, but the photo could not be attached. Please try again.");
          return;
        }
        result.data = attachmentResult.data;
      }

      if (editMode === "admin" && actorId) {
        const { error: eventError } = await supabase.from("request_events").insert({
          request_id: result.data.id,
          actor_id: actorId,
          actor_email: actorEmail ?? null,
          action: "edit",
          note: null,
          changes: { payload: payloadRecord },
        });
        if (eventError) console.error("Failed to record admin request edit", eventError);
      }

      if (submittedOnBehalf && actorId && actorId !== userId) {
        const { error: eventError } = await supabase.from("request_events").insert({
          request_id: result.data.id,
          actor_id: actorId,
          actor_email: actorEmail ?? null,
          action: "submit_on_behalf",
          note: null,
          changes: { requester_id: userId },
        });
        if (eventError) console.error("Failed to record submission representative", eventError);
      }

      if (onSaved) {
        onSaved(result.data as RequestRecord);
        return;
      }

      router.refresh();
      if (onClose) {
        onClose();
      } else {
        router.back();
      }
    });
  }

  const isEditing = Boolean(requestId);

  return (
    <Card className="mx-auto w-full max-w-5xl">
      <CardHeader>
        <CardTitle>{kindFormMeta[kind].title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(onSubmit, (errors) => {
            setBanner(firstErrorMessage(errors) ?? "Please fix the highlighted fields.");
          })}
        >
          {kind === "report_sick" ? (
            <ReportSickFields form={form} />
          ) : (
            <ExternalAppointmentFields
              form={form}
              proof={appointmentProof}
              existingProofName={initialRequest?.kind === "external_appointment"
                ? (initialRequest.payload as ExternalAppointmentPayload).proofName
                : undefined}
              onProofChange={(file, error) => {
                setAppointmentProof(file);
                setBanner(error);
              }}
            />
          )}

          {banner ? <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">{banner}</p> : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose ?? (() => router.back())}>
              Close
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : editMode === "admin" ? "Save changes" : isEditing ? "Update Request" : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function splitAppointmentWhen(value: unknown) {
  if (typeof value !== "string" || !value) {
    return {
      date: "",
      time: "",
    };
  }

  const [date = "", time = ""] = value.split("T");
  return {
    date,
    time: time.slice(0, 5),
  };
}

function combineAppointmentWhen(date: string, time: string) {
  if (!date && !time) return "";
  return `${date}T${time}`;
}

function ExternalAppointmentFields({
  form,
  proof,
  existingProofName,
  onProofChange,
}: {
  form: any;
  proof: File | null;
  existingProofName?: string;
  onProofChange: (file: File | null, error: string | null) => void;
}) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor="what">What appointment do you have?</Label>
        <Input id="what" {...form.register("what")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="where">Where is the appointment held?</Label>
        <Input id="where" {...form.register("where")} />
      </div>
      <Controller
        control={form.control}
        name="when"
        render={({ field }) => {
          const parts = splitAppointmentWhen(field.value);
          const selectedDate = parts.date ? parseISO(parts.date) : undefined;
          return (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Date</Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start px-4 text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {selectedDate && isValid(selectedDate) ? formatDisplayDate(selectedDate) : "Select a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full max-w-[20rem] p-4" align="start">
                    <Calendar
                      selected={selectedDate && isValid(selectedDate) ? selectedDate : undefined}
                      disableFuture={false}
                      onSelect={(date) => {
                        field.onChange(date ? combineAppointmentWhen(format(date, "yyyy-MM-dd"), parts.time) : "");
                        if (date) setDatePickerOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="appointmentTime">Time</Label>
                <Input
                  id="appointmentTime"
                  type="time"
                  className="text-left"
                  value={parts.time}
                  onChange={(event) => field.onChange(combineAppointmentWhen(parts.date, event.target.value))}
                  onBlur={field.onBlur}
                />
              </div>
            </div>
          );
        }}
      />
      <div className="grid gap-2">
        <Label htmlFor="lessonsMissed">Lessons Missed</Label>
        <Input id="lessonsMissed" {...form.register("lessonsMissed")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="why">Background</Label>
        <Textarea id="why" {...form.register("why")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="appointmentProof">Screenshot of Appointment/Booking</Label>
        <label
          htmlFor="appointmentProof"
          className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background/40 px-4 py-5 text-center transition-colors hover:bg-background/60"
        >
          {proof || existingProofName ? <ImageIcon className="h-6 w-6 text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
          <span className="text-sm font-medium text-foreground">{proof?.name ?? existingProofName ?? "Choose a photo"}</span>
          <span className="text-xs text-muted-foreground">JPEG, PNG, WebP or HEIC, up to 10 MB</span>
        </label>
        <Input
          id="appointmentProof"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (!file) return;
            if (!acceptedProofTypes.includes(file.type)) {
              onProofChange(null, "Please choose a JPEG, PNG, WebP or HEIC photo.");
              event.target.value = "";
              return;
            }
            if (file.size > maxProofBytes) {
              onProofChange(null, "The screenshot must be 10 MB or smaller.");
              event.target.value = "";
              return;
            }
            onProofChange(file, null);
          }}
        />
      </div>
    </div>
  );
}

function ReportSickFields({ form }: { form: any }) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor="dateReportingSick">Date Reporting Sick</Label>
        <Controller
          control={form.control}
          name="dateReportingSick"
          render={({ field }) => {
            const selectedDate = field.value ? parseISO(field.value) : undefined;
            return (
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start px-4 text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {selectedDate && isValid(selectedDate) ? formatDisplayDate(selectedDate) : "Select a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full max-w-[20rem] p-4" align="start">
                  <Calendar
                    selected={selectedDate && isValid(selectedDate) ? selectedDate : undefined}
                    onSelect={(date) => {
                      field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                      if (date) setDatePickerOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            );
          }}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="timeReportingSick">Time Reporting Sick</Label>
        <Input id="timeReportingSick" type="time" className="text-left" {...form.register("timeReportingSick")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="where">Where are you reporting sick?</Label>
        <Input id="where" {...form.register("where")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="symptoms">What symptoms are you currently experiencing?</Label>
        <Textarea id="symptoms" {...form.register("symptoms")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contractionSource">How did you contract these symptoms?</Label>
        <Textarea id="contractionSource" {...form.register("contractionSource")} />
      </div>
    </div>
  );
}
