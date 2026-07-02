import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Set all three course dates.");
const batchFields = z.object({
  name: z.string().trim().min(1).max(80),
  course_start: dateField,
  specialisation_phase_start: dateField,
  course_end: dateField,
});

function validateDates(batch: z.infer<typeof batchFields>, context: z.RefinementCtx) {
  const dates = [batch.course_start, batch.specialisation_phase_start, batch.course_end];
  if (dates[0]! > dates[1]! || dates[1]! > dates[2]!) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Course dates must be in chronological order." });
  }
}

const batchSchema = batchFields.superRefine(validateDates);
const updateBatchSchema = batchFields.extend({ id: z.string().uuid() }).superRefine(validateDates);
const deleteBatchSchema = z.object({ id: z.string().uuid() });

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ message: "Please sign in again." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ message: "You do not have permission to manage batches." }, { status: 403 }) };
  }
  return { supabase };
}

function batchValues(input: z.infer<typeof batchFields>) {
  return {
    name: input.name,
    course_start: input.course_start,
    common_term_end: input.specialisation_phase_start,
    course_end: input.course_end,
  };
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if (access.error || !access.supabase) return access.error;
  const parsed = batchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Check the batch details." }, { status: 400 });

  const { data, error } = await access.supabase.from("batches").insert(batchValues(parsed.data)).select().single();
  if (error || !data) {
    console.error("Could not create batch", error);
    return NextResponse.json({ message: error?.code === "23505" ? "A batch with that name already exists." : "The batch could not be created." }, { status: 400 });
  }
  return NextResponse.json({ batch: data });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if (access.error || !access.supabase) return access.error;
  const parsed = updateBatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Check the batch details." }, { status: 400 });

  const { data, error } = await access.supabase
    .from("batches")
    .update(batchValues(parsed.data))
    .eq("id", parsed.data.id)
    .select()
    .single();
  if (error || !data) {
    console.error("Could not update batch", error);
    return NextResponse.json({ message: error?.code === "23505" ? "A batch with that name already exists." : "The batch could not be updated." }, { status: 400 });
  }
  return NextResponse.json({ batch: data });
}

export async function DELETE(request: Request) {
  const access = await requireAdmin();
  if (access.error || !access.supabase) return access.error;
  const parsed = deleteBatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "This batch could not be deleted." }, { status: 400 });

  const { error } = await access.supabase.from("batches").delete().eq("id", parsed.data.id);
  if (error) {
    console.error("Could not delete batch", error);
    return NextResponse.json({ message: "This batch could not be deleted." }, { status: 500 });
  }
  return NextResponse.json({ id: parsed.data.id });
}
