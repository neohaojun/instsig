import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BatchRecord, ProfileRecord } from "@/lib/types";

export const runtime = "nodejs";

const nullableText = z.string().trim().max(120).nullable().optional();
const profileFieldsSchema = z.object({
  email: z.string().trim().email().max(254),
  full_name: z.string().trim().min(1).max(120),
  rank: nullableText,
  role: z.enum(["user", "admin"]).default("user"),
  scs_batch: nullableText,
  nr: nullableText,
  sscc_batch: nullableText,
  common_term_platoon: nullableText,
  specialisation_phase_platoon: nullableText,
});
const importedUserSchema = profileFieldsSchema.extend({
  row: z.number().int().positive(),
  password: z.string().min(1).max(128),
});
const importSchema = z.object({ users: z.array(z.unknown()).min(1).max(200) });
const updateSchema = profileFieldsSchema.extend({ id: z.string().uuid(), password: z.string().min(8).max(128).optional() });
const deleteSchema = z.object({ id: z.string().uuid() });

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ message: "Please sign in again." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ message: "You do not have permission to manage accounts." }, { status: 403 }) };
  }
  return { user };
}

function cleanNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function getBatchId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  batchName: string | null | undefined,
  batches: BatchRecord[],
) {
  const normalizedName = cleanNullable(batchName);
  if (!normalizedName) return null;
  const existing = batches.find((batch) => batch.name.toLowerCase() === normalizedName.toLowerCase());
  if (existing) return existing.id;
  const { data, error } = await admin.from("batches").insert({ name: normalizedName }).select().single();
  if (error || !data) throw error ?? new Error("batch-create-failed");
  batches.push(data as BatchRecord);
  return data.id as string;
}

function profileValues(input: z.infer<typeof profileFieldsSchema>, batchId: string | null) {
  return {
    email: input.email.toLowerCase(),
    full_name: input.full_name,
    rank: cleanNullable(input.rank),
    role: input.role,
    batch_id: batchId,
    nr: cleanNullable(input.nr),
    sscc_batch: cleanNullable(input.sscc_batch),
    common_term_platoon: cleanNullable(input.common_term_platoon),
    specialisation_phase_platoon: cleanNullable(input.specialisation_phase_platoon),
  };
}

function adminClientResponse() {
  try {
    return { admin: createSupabaseAdminClient() };
  } catch (error) {
    console.error("Could not create Supabase admin client", error);
    return { error: NextResponse.json({ message: "Account management is not configured on this server." }, { status: 503 }) };
  }
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "The spreadsheet data is invalid. Check every required column and try again." }, { status: 400 });
  }
  const client = adminClientResponse();
  if (client.error || !client.admin) return client.error;
  const admin = client.admin;
  const emails = new Set<string>();
  const results: Array<{ row: number; email: string; status: "created" | "failed"; message?: string; profile?: ProfileRecord }> = [];
  const { data: existingBatches, error: batchesError } = await admin.from("batches").select("*").order("name");
  if (batchesError) {
    console.error("Could not load batches for account import", batchesError);
    return NextResponse.json({ message: "We could not prepare the account import. Please try again." }, { status: 500 });
  }
  const batches = (existingBatches ?? []) as BatchRecord[];

  for (const rawInput of parsed.data.users) {
    const validatedInput = importedUserSchema.safeParse(rawInput);
    if (!validatedInput.success) {
      const record = typeof rawInput === "object" && rawInput ? rawInput as Record<string, unknown> : {};
      const row = typeof record.row === "number" ? record.row : 1;
      const email = typeof record.email === "string" ? record.email : "";
      results.push({
        row,
        email,
        status: "failed",
        message: validatedInput.error.issues.some((issue) => issue.path[0] === "password")
          ? "Password is required for imported accounts."
          : "Required account details are missing or invalid.",
      });
      continue;
    }
    const input = validatedInput.data;
    const email = input.email.toLowerCase();
    if (emails.has(email)) {
      results.push({ row: input.row, email, status: "failed", message: "Duplicate email in spreadsheet." });
      continue;
    }
    emails.add(email);
    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });
    if (createError || !authData.user) {
      console.error(`Could not create imported account on row ${input.row}`, createError);
      const duplicate = createError?.message.toLowerCase().includes("already") ?? false;
      results.push({ row: input.row, email, status: "failed", message: duplicate ? "An account with this email already exists." : "Account could not be created." });
      continue;
    }
    try {
      const batchId = await getBatchId(admin, input.scs_batch, batches);
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .upsert({ id: authData.user.id, ...profileValues(input, batchId) })
        .select()
        .single();
      if (profileError || !profile) throw profileError ?? new Error("profile-create-failed");
      results.push({ row: input.row, email, status: "created", profile: profile as ProfileRecord });
    } catch (error) {
      console.error(`Could not create imported profile on row ${input.row}`, error);
      const { error: rollbackError } = await admin.auth.admin.deleteUser(authData.user.id);
      if (rollbackError) console.error(`Could not roll back imported auth account on row ${input.row}`, rollbackError);
      results.push({ row: input.row, email, status: "failed", message: "Profile could not be saved." });
    }
  }
  return NextResponse.json({ results, batches });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Check the account fields and try again." }, { status: 400 });
  const client = adminClientResponse();
  if (client.error || !client.admin) return client.error;
  const admin = client.admin;
  const input = parsed.data;
  if (input.id === access.user.id && input.role !== "admin") {
    return NextResponse.json({ message: "You cannot remove your own admin access." }, { status: 400 });
  }
  const { data: currentProfile } = await admin.from("profiles").select("*").eq("id", input.id).single();
  if (!currentProfile) return NextResponse.json({ message: "This account no longer exists." }, { status: 404 });
  if (currentProfile.role === "admin" && input.role !== "admin") {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return NextResponse.json({ message: "At least one admin account is required." }, { status: 400 });
  }
  const { data: existingBatches } = await admin.from("batches").select("*").order("name");
  try {
    const batches = (existingBatches ?? []) as BatchRecord[];
    const batchId = await getBatchId(admin, input.scs_batch, batches);
    const { data: profile, error: profileError } = await admin.from("profiles").update(profileValues(input, batchId)).eq("id", input.id).select().single();
    if (profileError || !profile) throw profileError ?? new Error("profile-update-failed");

    const authUpdates: { email?: string; password?: string; user_metadata: { full_name: string } } = {
      user_metadata: { full_name: input.full_name },
    };
    if (input.email.toLowerCase() !== currentProfile.email.toLowerCase()) authUpdates.email = input.email.toLowerCase();
    if (input.password) authUpdates.password = input.password;
    const { error: authError } = await admin.auth.admin.updateUserById(input.id, authUpdates);
    if (authError) {
      console.error("Could not update auth account", authError);
      const previous = currentProfile as ProfileRecord;
      const { error: rollbackError } = await admin.from("profiles").update({
        email: previous.email,
        full_name: previous.full_name,
        rank: previous.rank,
        role: previous.role,
        batch_id: previous.batch_id,
        nr: previous.nr,
        sscc_batch: previous.sscc_batch,
        common_term_platoon: previous.common_term_platoon,
        specialisation_phase_platoon: previous.specialisation_phase_platoon,
      }).eq("id", input.id);
      if (rollbackError) console.error("Could not roll back account profile update", rollbackError);
      const duplicate = authError.message.toLowerCase().includes("already");
      return NextResponse.json({ message: duplicate ? "That email is already used by another account." : "The login details could not be updated." }, { status: 400 });
    }
    return NextResponse.json({ profile, batches });
  } catch (error) {
    console.error("Could not update account profile", error);
    return NextResponse.json({ message: "The profile details could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid account." }, { status: 400 });
  if (parsed.data.id === access.user.id) return NextResponse.json({ message: "You cannot delete your own account." }, { status: 400 });
  const client = adminClientResponse();
  if (client.error || !client.admin) return client.error;
  const admin = client.admin;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", parsed.data.id).single();
  if (!profile) return NextResponse.json({ message: "This account no longer exists." }, { status: 404 });
  if (profile.role === "admin") {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return NextResponse.json({ message: "The last admin account cannot be deleted." }, { status: 400 });
  }
  const { error } = await admin.auth.admin.deleteUser(parsed.data.id);
  if (error) {
    console.error("Could not delete auth account", error);
    return NextResponse.json({ message: "This account could not be deleted." }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
