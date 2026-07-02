"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Download, Edit2, FileSpreadsheet, Mail, Save, Search, Trash2, Upload, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { formatCoursePlatoon } from "@/lib/batch-display";
import { formatDisplayDate } from "@/lib/display-date";
import { formatProfileName } from "@/lib/profile-display";
import { readSpreadsheetRows } from "@/lib/spreadsheet-import";
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
  | "nr"
  | "ooc_date"
>;

type ProfileFormState = {
  email: string;
  password: string;
  full_name: string;
  rank: string;
  role: UserRole;
  scs_batch: string;
  common_term_platoon: string;
  sscc_batch: string;
  specialisation_phase_platoon: string;
  nr: string;
  ooc_date: string;
};

type ImportResult = {
  row: number;
  email: string;
  status: "created" | "failed";
  message?: string;
  profile?: EditableProfile;
};

class UserFacingError extends Error {}

const IMPORT_HEADERS = [
  "email",
  "password",
  "full_name",
  "rank",
  "role",
  "scs_batch",
  "nr",
  "sscc_batch",
  "common_term_platoon",
  "specialisation_phase_platoon",
] as const;

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
    email: profile.email,
    password: "",
    full_name: profile.full_name ?? "",
    rank: profile.rank ?? "",
    role: profile.role,
    scs_batch: batchName && batchName !== "Not Assigned" && batchName !== "Unknown Batch" ? formatBatchInput(batchName) : "",
    common_term_platoon: profile.common_term_platoon ?? "",
    sscc_batch: formatBatchInput(profile.sscc_batch ?? ""),
    specialisation_phase_platoon: profile.specialisation_phase_platoon ?? "",
    nr: profile.nr ?? "",
    ooc_date: profile.ooc_date ?? "",
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function spreadsheetErrorMessage(error: unknown) {
  if (error instanceof UserFacingError) return error.message;
  if (!(error instanceof Error)) return "We could not read this spreadsheet. Download a fresh template and try again.";
  if (error.message === "spreadsheet-too-large") return "Choose a CSV or XLSX file smaller than 5 MB.";
  if (error.message === "spreadsheet-type-unsupported") return "Choose a CSV or XLSX file.";
  return "We could not read this spreadsheet. Download a fresh template and try again.";
}

function downloadImportTemplate() {
  const example = ["cadet@example.com", "ChangeMe123!", "Cadet Name", "3SG", "user", "01/26", "01", "02/26", "Platoon 1", "Platoon 2"];
  const content = `\uFEFF${IMPORT_HEADERS.join(",")}\r\n${example.join(",")}\r\n`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "signal-institute-account-import.csv";
  link.click();
  URL.revokeObjectURL(url);
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

function OocDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsedDate = value ? parseISO(value) : undefined;
  const selectedDate = parsedDate && isValid(parsedDate) ? parsedDate : undefined;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-start px-4 text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            {selectedDate ? formatDisplayDate(selectedDate) : "Select OOC date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[70] w-[20rem] max-w-[calc(100vw-2rem)] bg-popover p-4 opacity-100 shadow-xl">
          <Calendar
            selected={selectedDate}
            initialFocus
            onSelect={(date) => {
              if (!date) return;
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value ? (
        <Button type="button" variant="outline" className="shrink-0" onClick={() => onChange("")}>Clear OOC</Button>
      ) : null}
    </div>
  );
}

function UserProfileCard({
  profileRow,
  batchName,
  batch,
  batchOptions,
  isEditing,
  isSaving,
  isDeleting,
  formState,
  errorMessage,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onChange,
}: {
  profileRow: EditableProfile;
  batchName: string;
  batch: BatchRecord | null | undefined;
  batchOptions: BatchRecord[];
  isEditing: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  formState: ProfileFormState;
  errorMessage?: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  onChange: (field: keyof ProfileFormState, value: string) => void;
}) {
  const displayName = formatProfileName(profileRow, profileRow.email);

  return (
    <Card className="overflow-visible transition hover:border-primary/20 hover:bg-accent/40">
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
              {isEditing ? (
                <FormField label="Email">
                  <Input type="email" value={formState.email} onChange={(event) => onChange("email", event.target.value)} />
                </FormField>
              ) : (
                <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="break-all">{profileRow.email}</span>
                </div>
              )}
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
              <EditableInfoField label="New Password" className="sm:col-span-2">
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current password"
                  value={formState.password}
                  onChange={(event) => onChange("password", event.target.value)}
                />
              </EditableInfoField>
              <EditableInfoField label="SCS Batch">
                <Select
                  value={formState.scs_batch}
                  onChange={(event) => onChange("scs_batch", event.target.value)}
                >
                  <option value="">Not Assigned</option>
                  {batchOptions.map((batch) => <option key={batch.id} value={batch.name}>{batch.name}</option>)}
                </Select>
              </EditableInfoField>
              <EditableInfoField label="Course Code">
                <Input
                  inputMode="numeric"
                  placeholder="--/--"
                  value={formState.sscc_batch}
                  onChange={(event) => onChange("sscc_batch", formatBatchInput(event.target.value))}
                />
              </EditableInfoField>
              <EditableInfoField label="NR">
                <Input value={formState.nr} onChange={(event) => onChange("nr", event.target.value)} />
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
              <EditableInfoField label="OOC (Out of Course)" className="sm:col-span-2">
                <OocDateField value={formState.ooc_date} onChange={(value) => onChange("ooc_date", value)} />
              </EditableInfoField>
            </div>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button variant="destructive" onClick={onDelete} disabled={isSaving || isDeleting} className="mr-auto">
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete account"}
              </Button>
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
            <InfoField label="Role" value={profileRow.role === "admin" ? "Admin" : "User"} />
            <InfoField label="SCS Batch" value={profileValue(batchName)} />
            <InfoField label="Course Code" value={profileValue(profileRow.sscc_batch)} />
            <InfoField label="NR" value={profileValue(profileRow.nr)} />
            <InfoField label="Course Status" value={profileRow.ooc_date ? `OOC from ${formatDisplayDate(profileRow.ooc_date)}` : "Active"} />
            <InfoField label="Current Platoon" value={profileValue(formatCoursePlatoon(profileRow, batch))} className="sm:col-span-2" />
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProfileFormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const batchesById = useMemo(() => Object.fromEntries(batchOptions.map((batch) => [batch.id, batch])), [batchOptions]);
  const filteredProfiles = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

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
          profile.nr,
          profile.ooc_date,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearchQuery);
      })
      .filter((profile) => roleFilter === "all" || profile.role === roleFilter)
      .filter((profile) => {
        if (!batchFilter) return true;
        return batchFilter === "unassigned" ? !profile.batch_id : profile.batch_id === batchFilter;
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

  async function saveProfile(profileId: string) {
    if (!formState) return;
    setSavingId(profileId);
    setSaveError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: profileId,
          email: formState.email.trim(),
          password: formState.password || undefined,
          full_name: formState.full_name.trim(),
          rank: emptyToNull(formState.rank),
          role: formState.role,
          scs_batch: emptyToNull(normalizeBatchName(formState.scs_batch)),
          nr: emptyToNull(formState.nr),
          sscc_batch: emptyToNull(normalizeBatchName(formState.sscc_batch)),
          common_term_platoon: emptyToNull(formState.common_term_platoon),
          specialisation_phase_platoon: emptyToNull(formState.specialisation_phase_platoon),
          ooc_date: formState.ooc_date || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new UserFacingError(payload.message || "We could not save this user right now.");
      setProfiles((current) => current.map((profile) => (profile.id === profileId ? { ...profile, ...payload.profile } : profile)));
      setBatchOptions(payload.batches ?? batchOptions);
      cancelEditing();
    } catch (error) {
      console.error("Failed to update user account", error);
      setSaveError(error instanceof UserFacingError ? error.message : "We could not save this user right now. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteProfile(profile: EditableProfile) {
    if (!window.confirm(`Delete ${formatProfileName(profile, profile.email)}? Their login and all linked request records will be permanently deleted.`)) return;
    setDeletingId(profile.id);
    setSaveError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profile.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new UserFacingError(payload.message || "This account could not be deleted.");
      setProfiles((current) => current.filter((item) => item.id !== profile.id));
      cancelEditing();
    } catch (error) {
      console.error("Failed to delete user account", error);
      setSaveError(error instanceof UserFacingError ? error.message : "This account could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  async function importAccounts(file: File) {
    setImporting(true);
    setImportError(null);
    setImportResults([]);
    try {
      const rows = await readSpreadsheetRows(file);
      if (rows.length < 2) throw new UserFacingError("The spreadsheet has no account rows.");
      const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim().toLowerCase());
      const missing = IMPORT_HEADERS.filter((header) => !headers.includes(header));
      if (missing.length) throw new UserFacingError(`Missing columns: ${missing.join(", ")}.`);
      const users = rows.slice(1).map((values, index) => {
        const record = Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() ?? ""]));
        return {
          row: index + 2,
          email: record.email,
          password: record.password,
          full_name: record.full_name,
          rank: record.rank || null,
          role: record.role?.toLowerCase() || "user",
          scs_batch: record.scs_batch ? normalizeBatchName(record.scs_batch) : null,
          nr: record.nr || null,
          sscc_batch: record.sscc_batch ? normalizeBatchName(record.sscc_batch) : null,
          common_term_platoon: record.common_term_platoon || null,
          specialisation_phase_platoon: record.specialisation_phase_platoon || null,
        };
      });
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users }),
      });
      const payload = await response.json();
      if (!response.ok) throw new UserFacingError(payload.message || "The accounts could not be imported.");
      const results = payload.results as ImportResult[];
      setImportResults(results);
      const created = results.flatMap((result) => (result.status === "created" && result.profile ? [result.profile] : []));
      setProfiles((current) => [...created, ...current]);
      setBatchOptions(payload.batches ?? batchOptions);
    } catch (error) {
      console.error("Failed to import accounts", error);
      setImportError(spreadsheetErrorMessage(error));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <Card className="overflow-hidden animate-enter-soft">
        <CardHeader className="space-y-2 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg leading-none">Add accounts from spreadsheet</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadImportTemplate}>
              <Download className="h-4 w-4" />
              Download template
            </Button>
            <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4" />
              {importing ? "Importing..." : "Upload spreadsheet"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importAccounts(file);
              }}
            />
          </div>
          {importError ? <p className="text-sm text-destructive">{importError}</p> : null}
          {importResults.length ? (
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm">
              <p className="font-medium">
                {importResults.filter((result) => result.status === "created").length} created, {importResults.filter((result) => result.status === "failed").length} failed
              </p>
              {importResults.some((result) => result.status === "failed") ? (
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {importResults.filter((result) => result.status === "failed").map((result) => (
                    <li key={`${result.row}-${result.email}`}>Row {result.row} · {result.email || "Missing email"}: {result.message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

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
              <Select
                id="batch-filter"
                value={batchFilter}
                onChange={(event) => setBatchFilter(event.target.value)}
              >
                <option value="">All Batches</option>
                <option value="unassigned">Not Assigned</option>
                {batchOptions.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
              </Select>
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
                  batch={profileRow.batch_id ? batchesById[profileRow.batch_id] : null}
                  batchOptions={batchOptions}
                  isEditing={isEditing}
                  isSaving={savingId === profileRow.id}
                  isDeleting={deletingId === profileRow.id}
                  formState={isEditing && formState ? formState : toFormState(profileRow, batchName)}
                  errorMessage={isEditing ? saveError ?? undefined : undefined}
                  onEdit={() => startEditing(profileRow)}
                  onCancel={cancelEditing}
                  onSave={() => saveProfile(profileRow.id)}
                  onDelete={() => deleteProfile(profileRow)}
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
