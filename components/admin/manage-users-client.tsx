"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Edit2, Mail, Save, Search, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatProfileName } from "@/lib/profile-display";
import type { BatchRecord, ProfileRecord, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type RoleFilter = "all" | UserRole;

type EditableProfile = Pick<
  ProfileRecord,
  | "id"
  | "email"
  | "full_name"
  | "rank"
  | "role"
  | "batch_id"
  | "common_term_platoon"
  | "sscc_batch"
  | "specialisation_phase_platoon"
>;

type ProfileFormState = {
  full_name: string;
  rank: string;
  role: UserRole;
  scs_batch: string;
  common_term_platoon: string;
  sscc_batch: string;
  specialisation_phase_platoon: string;
};

function profileValue(value: string | null | undefined) {
  return value && value.trim() ? value : "Not Set";
}

function formatBatchInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function normalizeBatchName(value: string) {
  return formatBatchInput(value).trim();
}

function toFormState(profile: EditableProfile, batchName?: string): ProfileFormState {
  return {
    full_name: profile.full_name ?? "",
    rank: profile.rank ?? "",
    role: profile.role,
    scs_batch: batchName && batchName !== "Not Assigned" && batchName !== "Unknown Batch" ? formatBatchInput(batchName) : "",
    common_term_platoon: profile.common_term_platoon ?? "",
    sscc_batch: formatBatchInput(profile.sscc_batch ?? ""),
    specialisation_phase_platoon: profile.specialisation_phase_platoon ?? "",
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function InfoField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/80 bg-muted/25 px-3 py-2.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium leading-5 text-foreground">{value}</p>
    </div>
  );
}

function EditableInfoField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-border/80 bg-muted/25 px-3 py-2.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function FormField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function UserProfileCard({
  profileRow,
  batchName,
  isEditing,
  isSaving,
  formState,
  errorMessage,
  onEdit,
  onCancel,
  onSave,
  onChange,
}: {
  profileRow: EditableProfile;
  batchName: string;
  isEditing: boolean;
  isSaving: boolean;
  formState: ProfileFormState;
  errorMessage?: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (field: keyof ProfileFormState, value: string) => void;
}) {
  const displayName = formatProfileName(profileRow, profileRow.email);

  return (
    <Card className="overflow-hidden transition hover:border-primary/20 hover:bg-accent/40">
      <CardHeader className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground",
                profileRow.role === "admin" && "border-foreground bg-foreground text-background",
              )}
            >
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              {isEditing ? (
                <div className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)]">
                  <FormField label="Rank">
                    <Input value={formState.rank} onChange={(event) => onChange("rank", event.target.value)} />
                  </FormField>
                  <FormField label="Full Name">
                    <Input value={formState.full_name} onChange={(event) => onChange("full_name", event.target.value)} />
                  </FormField>
                </div>
              ) : (
                <CardTitle className="break-words text-base leading-snug sm:text-lg">{displayName}</CardTitle>
              )}
              <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="break-all">{profileRow.email}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            {isEditing ? (
              <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSaving} aria-label="Cancel editing">
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-9 w-9 px-0" onClick={onEdit} aria-label={`Edit ${displayName}`}>
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 pt-0">
        {isEditing ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <EditableInfoField label="Role" className="sm:col-span-2">
                <Select value={formState.role} onChange={(event) => onChange("role", event.target.value)}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </Select>
              </EditableInfoField>
              <EditableInfoField label="SCS Batch">
                <Input
                  inputMode="numeric"
                  placeholder="--/--"
                  value={formState.scs_batch}
                  onChange={(event) => onChange("scs_batch", formatBatchInput(event.target.value))}
                />
              </EditableInfoField>
              <EditableInfoField label="Course Code">
                <Input
                  inputMode="numeric"
                  placeholder="--/--"
                  value={formState.sscc_batch}
                  onChange={(event) => onChange("sscc_batch", formatBatchInput(event.target.value))}
                />
              </EditableInfoField>
              <EditableInfoField label="Common Term Platoon" className="sm:col-span-2">
                <Input
                  value={formState.common_term_platoon}
                  onChange={(event) => onChange("common_term_platoon", event.target.value)}
                />
              </EditableInfoField>
              <EditableInfoField label="Specialisation Phase Platoon" className="sm:col-span-2">
                <Input
                  value={formState.specialisation_phase_platoon}
                  onChange={(event) => onChange("specialisation_phase_platoon", event.target.value)}
                />
              </EditableInfoField>
            </div>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={onCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={onSave} disabled={isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <InfoField label="SCS Batch" value={profileValue(batchName)} />
            <InfoField label="Course Code" value={profileValue(profileRow.sscc_batch)} />
            <InfoField label="Common Term Platoon" value={profileValue(profileRow.common_term_platoon)} className="sm:col-span-2" />
            <InfoField
              label="Specialisation Phase Platoon"
              value={profileValue(profileRow.specialisation_phase_platoon)}
              className="sm:col-span-2"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ManageUsersClient({
  initialProfiles,
  batches,
}: {
  initialProfiles: EditableProfile[];
  batches: BatchRecord[];
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [batchOptions, setBatchOptions] = useState(batches);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [batchFilter, setBatchFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProfileFormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const batchesById = useMemo(() => Object.fromEntries(batchOptions.map((batch) => [batch.id, batch])), [batchOptions]);
  const filteredProfiles = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const normalizedBatchFilter = batchFilter.trim().toLowerCase();

    return profiles
      .filter((profile) => {
        if (!normalizedSearchQuery) return true;
        const batchName = profile.batch_id ? batchesById[profile.batch_id]?.name ?? "Unknown Batch" : "Not Assigned";
        const searchableText = [
          formatProfileName(profile, profile.email),
          profile.full_name,
          profile.rank,
          profile.email,
          profile.role,
          batchName,
          profile.sscc_batch,
          profile.common_term_platoon,
          profile.specialisation_phase_platoon,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearchQuery);
      })
      .filter((profile) => roleFilter === "all" || profile.role === roleFilter)
      .filter((profile) => {
        if (!normalizedBatchFilter) return true;
        const batchName = profile.batch_id ? batchesById[profile.batch_id]?.name ?? "Unknown Batch" : "Not Assigned";
        return batchName.toLowerCase().includes(normalizedBatchFilter);
      })
      .sort((a, b) => formatProfileName(a, a.email).localeCompare(formatProfileName(b, b.email), undefined, { sensitivity: "base" }));
  }, [batchFilter, batchesById, profiles, roleFilter, searchQuery]);

  function startEditing(profile: EditableProfile) {
    const batchName = profile.batch_id ? batchesById[profile.batch_id]?.name : undefined;
    setEditingId(profile.id);
    setFormState(toFormState(profile, batchName));
    setSaveError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setFormState(null);
    setSaveError(null);
  }

  function updateForm(field: keyof ProfileFormState, value: string) {
    setFormState((current) => (current ? { ...current, [field]: value } : current));
  }

  async function resolveBatchId(supabase: ReturnType<typeof createSupabaseBrowserClient>, value: string) {
    const batchName = normalizeBatchName(value);
    if (!batchName) return null;

    const existingBatch = batchOptions.find((batch) => batch.name.toLowerCase() === batchName.toLowerCase());
    if (existingBatch) return existingBatch.id;

    const { data, error } = await supabase.from("batches").insert({ name: batchName }).select().single();
    if (error || !data) {
      console.error("Failed to create SCS batch", error);
      throw new Error("batch-create-failed");
    }

    const createdBatch = data as BatchRecord;
    setBatchOptions((current) => [...current, createdBatch].sort((a, b) => a.name.localeCompare(b.name)));
    return createdBatch.id;
  }

  async function saveProfile(profileId: string) {
    if (!formState) return;

    const supabase = createSupabaseBrowserClient();
    setSavingId(profileId);
    setSaveError(null);

    let batchId: string | null;
    try {
      batchId = await resolveBatchId(supabase, formState.scs_batch);
    } catch {
      setSavingId(null);
      setSaveError("We could not save this SCS batch right now. Please try again.");
      return;
    }

    const updates = {
      full_name: emptyToNull(formState.full_name),
      rank: emptyToNull(formState.rank),
      role: formState.role,
      batch_id: batchId,
      common_term_platoon: emptyToNull(formState.common_term_platoon),
      sscc_batch: emptyToNull(normalizeBatchName(formState.sscc_batch)),
      specialisation_phase_platoon: emptyToNull(formState.specialisation_phase_platoon),
    };

    const { data, error } = await supabase.from("profiles").update(updates).eq("id", profileId).select().single();
    setSavingId(null);

    if (error || !data) {
      console.error("Failed to update user profile", error);
      setSaveError("We could not save this user right now. Please try again.");
      return;
    }

    setProfiles((current) => current.map((profile) => (profile.id === profileId ? { ...profile, ...data } : profile)));
    cancelEditing();
  }

  return (
    <>
      <Card className="overflow-hidden animate-enter-soft">
        <CardHeader className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-full flex-1 space-y-2 md:min-w-80 md:flex-[2]">
              <Label htmlFor="user-search">Search users</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="user-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, rank, email, batch, or platoon"
                  className="pl-9 pr-10"
                />
                {searchQuery ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 px-0"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear user search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor="role-filter">Role</Label>
              <Select id="role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}>
                <option value="all">All Users</option>
                <option value="admin">Admins</option>
                <option value="user">Non-Admins</option>
              </Select>
            </div>
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor="batch-filter">SCS Batch</Label>
              <Input
                id="batch-filter"
                inputMode="numeric"
                placeholder="Type SCS Batch"
                value={batchFilter}
                onChange={(event) => setBatchFilter(formatBatchInput(event.target.value))}
              />
            </div>
            <p className="pb-3 text-sm text-muted-foreground md:ml-auto">
              {filteredProfiles.length} of {profiles.length} users
            </p>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredProfiles.length ? (
          filteredProfiles.map((profileRow, index) => {
            const batchName = profileRow.batch_id ? batchesById[profileRow.batch_id]?.name ?? "Unknown Batch" : "Not Assigned";
            const isEditing = editingId === profileRow.id;

            return (
              <div key={profileRow.id} className={index < 2 ? "animate-enter-soft" : ""}>
                <UserProfileCard
                  profileRow={profileRow}
                  batchName={batchName}
                  isEditing={isEditing}
                  isSaving={savingId === profileRow.id}
                  formState={isEditing && formState ? formState : toFormState(profileRow, batchName)}
                  errorMessage={isEditing ? saveError ?? undefined : undefined}
                  onEdit={() => startEditing(profileRow)}
                  onCancel={cancelEditing}
                  onSave={() => saveProfile(profileRow.id)}
                  onChange={updateForm}
                />
              </div>
            );
          })
        ) : (
          <Card className="overflow-hidden sm:col-span-2 xl:col-span-3">
            <CardContent className="p-6 text-sm text-muted-foreground">No users match those filters.</CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
