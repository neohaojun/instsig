import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatNr } from "@/lib/profile-display";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BatchRecord, ProfileRecord } from "@/lib/types";

export const runtime = "nodejs";

const nullableText = z.string().trim().max(120).nullable().optional();
const profileFieldsSchema = z.object({
  email: z.string().trim().email().max(254),
  full_name: z.string().trim().min(1).max(120),
  rank: nullableText,
  role: z.enum(["user", "admin"]).default("user"),
  unit_id: z.string().uuid().nullable().optional(),
  scs_batch: nullableText,
  nr: nullableText,
  sscc_batch: nullableText,
  common_term_platoon: nullableText,
  specialisation_phase_platoon: nullableText,
  ooc_date: z.string().date().nullable().optional(),
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
  const { data: profile } = await supabase.from("profiles").select("id, role, unit_id").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ message: "You do not have permission to manage accounts." }, { status: 403 }) };
  }
  return { user, supabase, profile };
}

function cleanNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function getBatchId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  batchName: string | null | undefined,
  batches: BatchRecord[],
  unitId: string,
) {
  const normalizedName = cleanNullable(batchName);
  if (!normalizedName) return null;
  const existing = batches.find((batch) => batch.unit_id === unitId && batch.name.toLowerCase() === normalizedName.toLowerCase());
  if (existing) return existing.id;
  const { data, error } = await admin.from("batches").insert({ name: normalizedName, unit_id: unitId }).select().single();
  if (error || !data) throw error ?? new Error("batch-create-failed");
  batches.push(data as BatchRecord);
  return data.id as string;
}

function profileValues(input: z.infer<typeof profileFieldsSchema>, batchId: string | null, unitId: string) {
  return {
    email: input.email.toLowerCase(),
    full_name: input.full_name,
    rank: cleanNullable(input.rank),
    role: input.role,
    unit_id: unitId,
    batch_id: batchId,
    nr: cleanNullable(formatNr(input.nr)),
    sscc_batch: cleanNullable(input.sscc_batch),
    common_term_platoon: cleanNullable(input.common_term_platoon),
    specialisation_phase_platoon: cleanNullable(input.specialisation_phase_platoon),
    ooc_date: input.ooc_date ?? null,
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

async function isParentUnit(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  unitId: string,
) {
  const { count, error } = await supabase
    .from("units")
    .select("id", { count: "exact", head: true })
    .eq("parent_unit_id", unitId)
    .eq("active", true);
  if (error) {
    console.error("Could not validate account unit", error);
    return null;
  }
  return (count ?? 0) > 0;
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
  const results: Array<{ row: number; email: string; status: "created" | "updated" | "failed"; message?: string; profile?: ProfileRecord }> = [];
  const { data: existingBatches, error: batchesError } = await admin.from("batches").select("*").order("name");
  if (batchesError) {
    console.error("Could not load batches for account import", batchesError);
    return NextResponse.json({ message: "We could not prepare the account import. Please try again." }, { status: 500 });
  }
  const batches = (existingBatches ?? []) as BatchRecord[];
  const { data: defaultUnit } = access.profile.unit_id
    ? { data: { id: access.profile.unit_id } }
    : await admin.from("units").select("id").eq("code", "SCTW").single();
  if (!defaultUnit) return NextResponse.json({ message: "The default unit is not configured." }, { status: 500 });

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
    const targetUnitId = input.unit_id ?? defaultUnit.id;
    const { data: canManageTargetUnit } = await access.supabase.rpc("can_manage_unit", { p_unit_id: targetUnitId });
    if (!canManageTargetUnit) {
      results.push({ row: input.row, email, status: "failed", message: "You cannot create accounts in that unit." });
      continue;
    }
    if (input.role === "user" && (await isParentUnit(access.supabase, targetUnitId)) !== false) {
      results.push({ row: input.row, email, status: "failed", message: "Users must be assigned to a training unit, not a parent unit." });
      continue;
    }
    const { data: existingProfile, error: existingProfileError } = await admin
      .from("profiles")
      .select("*")
      .ilike("email", email)
      .maybeSingle();
    if (existingProfileError) {
      console.error(`Could not check imported account on row ${input.row}`, existingProfileError);
      results.push({ row: input.row, email, status: "failed", message: "Account could not be checked." });
      continue;
    }
    if (existingProfile) {
      const { data: canManageCurrentUnit } = await access.supabase.rpc("can_manage_unit", { p_unit_id: existingProfile.unit_id });
      if (!canManageCurrentUnit) {
        results.push({ row: input.row, email, status: "failed", message: "You cannot update this account." });
        continue;
      }
      if (existingProfile.role === "admin" && input.role !== "admin") {
        const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
        if ((count ?? 0) <= 1) {
          results.push({ row: input.row, email, status: "failed", message: "The last admin account cannot be changed to a user." });
          continue;
        }
      }
      try {
        const batchId = input.role === "admin" ? null : await getBatchId(admin, input.scs_batch, batches, targetUnitId);
        const { data: profile, error: profileError } = await admin
          .from("profiles")
          .update(profileValues(input, batchId, targetUnitId))
          .eq("id", existingProfile.id)
          .select()
          .single();
        if (profileError || !profile) throw profileError ?? new Error("profile-update-failed");
        const { error: membershipError } = await admin.from("unit_memberships").upsert({
          profile_id: existingProfile.id,
          unit_id: targetUnitId,
          membership_role: input.role === "admin" ? "unit_admin" : "member",
        });
        if (membershipError) throw membershipError;
        const { error: staleMembershipError } = await admin
          .from("unit_memberships")
          .delete()
          .eq("profile_id", existingProfile.id)
          .neq("unit_id", targetUnitId);
        if (staleMembershipError) throw staleMembershipError;
        const { error: authError } = await admin.auth.admin.updateUserById(existingProfile.id, {
          user_metadata: { full_name: input.full_name },
        });
        if (authError) throw authError;
        results.push({ row: input.row, email, status: "updated", profile: profile as ProfileRecord });
      } catch (error) {
        console.error(`Could not update imported account on row ${input.row}`, error);
        results.push({ row: input.row, email, status: "failed", message: "Account could not be updated." });
      }
      continue;
    }
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
      const unitId = targetUnitId;
      const batchId = input.role === "admin" ? null : await getBatchId(admin, input.scs_batch, batches, unitId);
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .upsert({ id: authData.user.id, ...profileValues(input, batchId, unitId) })
        .select()
        .single();
      if (profileError || !profile) throw profileError ?? new Error("profile-create-failed");
      const { error: membershipError } = await admin.from("unit_memberships").upsert({
        profile_id: authData.user.id,
        unit_id: unitId,
        membership_role: input.role === "admin" ? "unit_admin" : "member",
      });
      if (membershipError) throw membershipError;
      const { error: staleMembershipError } = await admin
        .from("unit_memberships")
        .delete()
        .eq("profile_id", authData.user.id)
        .neq("unit_id", unitId);
      if (staleMembershipError) throw staleMembershipError;
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
  const { data: scopedProfile } = await access.supabase.from("profiles").select("id, unit_id").eq("id", input.id).maybeSingle();
  if (!scopedProfile) return NextResponse.json({ message: "You do not have permission to manage this account." }, { status: 403 });
  const { data: canManageCurrentUnit } = await access.supabase.rpc("can_manage_unit", { p_unit_id: scopedProfile.unit_id });
  const { data: canManageNextUnit } = input.unit_id
    ? await access.supabase.rpc("can_manage_unit", { p_unit_id: input.unit_id })
    : { data: canManageCurrentUnit };
  if (!canManageCurrentUnit || !canManageNextUnit) {
    return NextResponse.json({ message: "You do not have permission to move or manage this account." }, { status: 403 });
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
    const unitId = input.unit_id ?? currentProfile.unit_id;
    if (!unitId) return NextResponse.json({ message: "Select a unit for this account." }, { status: 400 });
    if (input.role === "user" && (await isParentUnit(access.supabase, unitId)) !== false) {
      return NextResponse.json({ message: "Users must be assigned to a training unit, not a parent unit." }, { status: 400 });
    }
    const batchId = input.role === "admin" ? null : await getBatchId(admin, input.scs_batch, batches, unitId);
    const { data: profile, error: profileError } = await admin.from("profiles").update(profileValues(input, batchId, unitId)).eq("id", input.id).select().single();
    if (profileError || !profile) throw profileError ?? new Error("profile-update-failed");
    const { error: membershipError } = await admin.from("unit_memberships").upsert({
      profile_id: input.id,
      unit_id: unitId,
      membership_role: input.role === "admin" ? "unit_admin" : "member",
    });
    if (membershipError) throw membershipError;
    const { error: staleMembershipError } = await admin
      .from("unit_memberships")
      .delete()
      .eq("profile_id", input.id)
      .neq("unit_id", unitId);
    if (staleMembershipError) throw staleMembershipError;

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
        unit_id: previous.unit_id,
        batch_id: previous.batch_id,
        nr: previous.nr,
        sscc_batch: previous.sscc_batch,
        common_term_platoon: previous.common_term_platoon,
        specialisation_phase_platoon: previous.specialisation_phase_platoon,
        ooc_date: previous.ooc_date,
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
  const { data: scopedProfile } = await access.supabase.from("profiles").select("id, unit_id").eq("id", parsed.data.id).maybeSingle();
  if (!scopedProfile) return NextResponse.json({ message: "You do not have permission to delete this account." }, { status: 403 });
  const { data: canManageTarget } = await access.supabase.rpc("can_manage_unit", { p_unit_id: scopedProfile.unit_id });
  if (!canManageTarget) return NextResponse.json({ message: "You do not have permission to delete this account." }, { status: 403 });
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
