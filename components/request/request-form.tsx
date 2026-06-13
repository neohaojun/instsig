"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon } from "lucide-react";
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

type FormValues = z.infer<typeof reportSickSchema> | z.infer<typeof externalAppointmentSchema>;

const kindFormMeta: Record<RequestKind, { title: string }> = {
  report_sick: {
    title: "Report Sick",
  },
  external_appointment: {
    title: "External appointment",
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
  initialRequest,
}: {
  kind: RequestKind;
  userEmail: string;
  userId: string;
  initialRequest?: RequestRecord | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("id");
  const [pending, startTransition] = useTransition();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [banner, setBanner] = useState<string | null>(null);

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
    const payloadRecord = payload as ReportSickPayload | ExternalAppointmentPayload;

    startTransition(async () => {
      const baseRequest = {
        kind,
        requester_id: userId,
        requester_email: userEmail,
        payload: payloadRecord,
        status: "pending" as const,
        updated_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      };

      const result = requestId
        ? await supabase.from("requests").update(baseRequest).eq("id", requestId).select().single()
        : await supabase.from("requests").insert(baseRequest).select().single();

      if (result.error) {
        setBanner("We couldn't save this request right now. Please try again.");
        return;
      }

      router.refresh();
      router.back();
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
            <ExternalAppointmentFields form={form} />
          )}

          {banner ? <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">{banner}</p> : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Close
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : isEditing ? "Update Request" : "Submit Request"}
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

function ExternalAppointmentFields({ form }: { form: any }) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor="what">What</Label>
        <Input id="what" placeholder="Appointment purpose" {...form.register("what")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="where">Where</Label>
        <Input id="where" placeholder="Location" {...form.register("where")} />
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
                <Label>Appointment Date</Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start px-4 text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {selectedDate && isValid(selectedDate) ? format(selectedDate, "dd MMM yyyy") : "Select a date"}
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
                <Label htmlFor="appointmentTime">Appointment Time</Label>
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
        <Label htmlFor="lessonsMissed">Lessons missed</Label>
        <Input id="lessonsMissed" placeholder="PT, Weapons Training, etc." {...form.register("lessonsMissed")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="why">Why</Label>
        <Textarea id="why" placeholder="Background / reason" {...form.register("why")} />
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
                    {selectedDate && isValid(selectedDate) ? format(selectedDate, "dd MMM yyyy") : "Select a date"}
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
        <Input id="where" placeholder="Clinic / hospital / home" {...form.register("where")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="symptoms">What symptoms are you currently experiencing?</Label>
        <Textarea id="symptoms" placeholder="Describe your symptoms" {...form.register("symptoms")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contractionSource">How did you contract these symptoms?</Label>
        <Textarea id="contractionSource" placeholder="Describe the likely source or cause" {...form.register("contractionSource")} />
      </div>
    </div>
  );
}
