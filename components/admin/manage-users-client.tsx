"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Edit2, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
type BatchFilter = "all" | "none" | string;

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
  | "nr"
>;

type ProfileFormState = {
  full_name: string;
  rank: string;
  role: UserRole;
  batch_id: string;
  common_term_platoon: string;
  sscc_batch: string;
  specialisation_phase_platoon: string;
  nr: string;
};

function profileValue(value: string | null | undefined) {
  return value && value.trim() ? value : "Not set";
}

function toFormState(profile: EditableProfile): ProfileFormState {
  return {
    full_name: profile.full_name ?? "",
    rank: profile.rank ?? "",
    role: profile.role,
    batch_id: profile.batch_id ?? "",
    common_term_platoon: profile.common_term_platoon ?? "",
    sscc_batch: profile.sscc_batch ?? "",
    specialisation_phase_platoon: profile.specialisation_phase_platoon ?? "",
    nr: profile.nr ?? "",
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
    <div className={className}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <div className="mt-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-foreground">
        {value}
      </div>
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
  batches,
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
  batches: BatchRecord[];
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
    <Card className="overflow-hidden transition hover:bg-accent/50">
      <CardHeader className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate text-xl">{displayName}</CardTitle>
            <p className="break-all text-sm text-muted-foreground">{profileRow.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={profileRow.role === "admin" ? "default" : "secondary"} className="shrink-0 capitalize">
              {profileRow.role}
            </Badge>
            {isEditing ? (
              <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSaving} aria-label="Cancel editing">
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit2 className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 pt-0 sm:p-6 sm:pt-0">
        {isEditing ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name">
                <Input value={formState.full_name} onChange={(event) => onChange("full_name", event.target.value)} />
              </FormField>
              <FormField label="Rank">
                <Input value={formState.rank} onChange={(event) => onChange("rank", event.target.value)} />
              </FormField>
              <FormField label="Role">
                <Select value={formState.role} onChange={(event) => onChange("role", event.target.value)}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </Select>
              </FormField>
              <FormField label="Batch">
                <Select value={formState.batch_id} onChange={(event) => onChange("batch_id", event.target.value)}>
                  <option value="">Not assigned</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="NR">
                <Input value={formState.nr} onChange={(event) => onChange("nr", event.target.value)} />
              </FormField>
              <FormField label="SSCC batch">
                <Input value={formState.sscc_batch} onChange={(event) => onChange("sscc_batch", event.target.value)} />
              </FormField>
              <FormField label="Common term platoon" className="sm:col-span-2">
                <Input
                  value={formState.common_term_platoon}
                  onChange={(event) => onChange("common_term_platoon", event.target.value)}
                />
              </FormField>
              <FormField label="Specialisation phase platoon" className="sm:col-span-2">
                <Input
                  value={formState.specialisation_phase_platoon}
                  onChange={(event) => onChange("specialisation_phase_platoon", event.target.value)}
                />
              </FormField>
            </div>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            <div className="flex flex-wrap justify-end gap-3">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoField label="Rank" value={profileValue(profileRow.rank)} />
            <InfoField label="NR" value={profileValue(profileRow.nr)} />
            <InfoField label="Batch" value={profileValue(batchName)} />
            <InfoField label="SSCC batch" value={profileValue(profileRow.sscc_batch)} />
            <InfoField label="Common term platoon" value={profileValue(profileRow.common_term_platoon)} className="sm:col-span-2" />
            <InfoField
              label="Specialisation phase platoon"
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
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [batchFilter, setBatchFilter] = useState<BatchFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProfileFormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const batchesById = useMemo(() => Object.fromEntries(batches.map((batch) => [batch.id, batch])), [batches]);
  const filteredProfiles = useMemo(() => {
    return profiles
      .filter((profile) => roleFilter === "all" || profile.role === roleFilter)
      .filter((profile) => {
        if (batchFilter === "all") return true;
        if (batchFilter === "none") return !profile.batch_id;
        return profile.batch_id === batchFilter;
      })
      .sort((a, b) => formatProfileName(a, a.email).localeCompare(formatProfileName(b, b.email), undefined, { sensitivity: "base" }));
  }, [batchFilter, profiles, roleFilter]);

  function startEditing(profile: EditableProfile) {
    setEditingId(profile.id);
    setFormState(toFormState(profile));
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

  async function saveProfile(profileId: string) {
    if (!formState) return;

    const supabase = createSupabaseBrowserClient();
    const updates = {
      full_name: emptyToNull(formState.full_name),
      rank: emptyToNull(formState.rank),
      role: formState.role,
      batch_id: formState.batch_id || null,
      common_term_platoon: emptyToNull(formState.common_term_platoon),
      sscc_batch: emptyToNull(formState.sscc_batch),
      specialisation_phase_platoon: emptyToNull(formState.specialisation_phase_platoon),
      nr: emptyToNull(formState.nr),
    };

    setSavingId(profileId);
    setSaveError(null);
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
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor="role-filter">Role</Label>
              <Select id="role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}>
                <option value="all">All users</option>
                <option value="admin">Admins</option>
                <option value="user">Non-admins</option>
              </Select>
            </div>
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor="batch-filter">Batch</Label>
              <Select id="batch-filter" value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)}>
                <option value="all">All batches</option>
                <option value="none">Not assigned</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </Select>
            </div>
            <p className="pb-3 text-sm text-muted-foreground">
              {filteredProfiles.length} of {profiles.length} users
            </p>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredProfiles.length ? (
          filteredProfiles.map((profileRow, index) => {
            const batchName = profileRow.batch_id ? batchesById[profileRow.batch_id]?.name ?? "Unknown batch" : "Not assigned";
            const isEditing = editingId === profileRow.id;

            return (
              <div key={profileRow.id} className={index < 2 ? "animate-enter-soft" : ""}>
                <UserProfileCard
                  profileRow={profileRow}
                  batchName={batchName}
                  batches={batches}
                  isEditing={isEditing}
                  isSaving={savingId === profileRow.id}
                  formState={isEditing && formState ? formState : toFormState(profileRow)}
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
