"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown, Download, Edit2, FileSpreadsheet, Loader2, Mail, Save, Search, Trash2, Upload, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { formatCoursePlatoon } from "@/lib/batch-display";
import { formatDisplayDate } from "@/lib/display-date";
import { formatNr, formatProfileName } from "@/lib/profile-display";
import { readSpreadsheetRows } from "@/lib/spreadsheet-import";
import type { BatchRecord, ProfileRecord, UnitRecord, UserRole } from "@/lib/types";
import { getBatchUnitIds, getUnitLabel } from "@/lib/unit-scope";
import { cn } from "@/lib/utils";

type RoleFilter = "all" | UserRole;

type EditableProfile = Pick<
  ProfileRecord,
  | "id"
  | "email"
  | "full_name"
  | "rank"
  | "role"
  | "unit_id"
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
  unit_id: string;
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
  status: "created" | "updated" | "failed";
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
  const numericValue = Number(value);
  if (/^\d{5}(?:\.\d+)?$/.test(value.trim()) && Number.isFinite(numericValue)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + Math.floor(numericValue) * 86_400_000);
    const year = date.getUTCFullYear();
    if (year >= 2000 && year <= 2099) {
      return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(year).slice(-2)}`;
    }
  }
  return formatBatchInput(value).trim();
}

function toFormState(profile: EditableProfile, batchName?: string): ProfileFormState {
  return {
    email: profile.email,
    password: "",
    full_name: profile.full_name ?? "",
    rank: profile.rank ?? "",
    role: profile.role,
    unit_id: profile.unit_id ?? "",
    scs_batch: batchName && batchName !== "Not Assigned" && batchName !== "Unknown Batch" ? formatBatchInput(batchName) : "",
    common_term_platoon: profile.common_term_platoon ?? "",
    sscc_batch: formatBatchInput(profile.sscc_batch ?? ""),
    specialisation_phase_platoon: profile.specialisation_phase_platoon ?? "",
    nr: formatNr(profile.nr),
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
    <div className={cn("min-w-0", className)}>
      <p className="text-muted-foreground">{label}</p>
      <p className="break-words text-foreground">{value}</p>
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
  unitName,
  onEdit,
}: {
  profileRow: EditableProfile;
  batchName: string;
  batch: BatchRecord | null | undefined;
  unitName: string;
  onEdit: () => void;
}) {
  const displayName = formatProfileName(profileRow, profileRow.email);

  return (
    <Card className="h-full min-w-0 overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3 p-5 sm:p-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground",
              profileRow.role === "admin" && "border-foreground bg-foreground text-background",
            )}
          >
            <UserRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="break-words text-base leading-snug sm:text-lg">{displayName}</CardTitle>
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-all sm:truncate">{profileRow.email}</span>
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={onEdit} aria-label={`Edit ${displayName}`}>
          <Edit2 className="h-4 w-4" />
          <span className="hidden sm:inline">Edit</span>
        </Button>
      </CardHeader>
      <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <InfoField label="Role" value={profileRow.role === "admin" ? "Admin" : "User"} />
            <InfoField label="Unit" value={profileValue(unitName)} />
            <InfoField label="SCS Batch" value={profileValue(batchName)} />
            <InfoField label="Course Code / NR" value={`${profileValue(profileRow.sscc_batch)} · ${profileValue(formatNr(profileRow.nr))}`} />
            <InfoField label="Course Status" value={profileRow.ooc_date ? `OOC from ${formatDisplayDate(profileRow.ooc_date)}` : "Active"} />
            <InfoField label="Current Platoon" value={profileValue(formatCoursePlatoon(profileRow, batch))} />
          </div>
      </CardContent>
    </Card>
  );
}

function EditUserDialog({
  profile,
  batchOptions,
  units,
  formState,
  isSaving,
  isDeleting,
  errorMessage,
  onClose,
  onSave,
  onDelete,
  onChange,
}: {
  profile: EditableProfile | null;
  batchOptions: BatchRecord[];
  units: UnitRecord[];
  formState: ProfileFormState | null;
  isSaving: boolean;
  isDeleting: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onChange: (field: keyof ProfileFormState, value: string) => void;
}) {
  const open = Boolean(profile && formState);
  const batchUnitIds = getBatchUnitIds(units);
  const assignableUnits = formState?.role === "admin"
    ? units
    : units.filter((unit) => batchUnitIds.has(unit.id));
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isSaving && !isDeleting) onClose(); }}>
      <DialogContent className="h-[100dvh] sm:h-auto sm:max-w-3xl" dismissible={!isSaving && !isDeleting} aria-labelledby="edit-user-title">
        {profile && formState ? (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 id="edit-user-title" className="text-xl font-semibold">Edit user</h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">{formatProfileName(profile, profile.email)}</p>
              </div>
              <Button type="button" size="sm" variant="ghost" className="h-9 w-9 shrink-0 px-0" onClick={onClose} disabled={isSaving || isDeleting} aria-label="Close editor">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-6">
                <section className="space-y-4">
                  <div>
                    <h3 className="font-medium">Account</h3>
                    <p className="text-sm text-muted-foreground">Login, identity, and access level.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Rank">
                      <Input value={formState.rank} onChange={(event) => onChange("rank", event.target.value)} />
                    </FormField>
                    <FormField label="Full Name">
                      <Input value={formState.full_name} onChange={(event) => onChange("full_name", event.target.value)} />
                    </FormField>
                    <FormField label="Email" className="sm:col-span-2">
                      <Input type="email" value={formState.email} onChange={(event) => onChange("email", event.target.value)} />
                    </FormField>
                    <FormField label="Role">
                      <Select
                        value={formState.role}
                        onChange={(event) => {
                          const nextRole = event.target.value as UserRole;
                          onChange("role", nextRole);
                          if (nextRole === "user" && !batchUnitIds.has(formState.unit_id)) {
                            onChange("unit_id", "");
                            onChange("scs_batch", "");
                          }
                        }}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </FormField>
                    <FormField label={formState.role === "admin" ? "Admin Scope" : "Unit"}>
                      <Select value={formState.unit_id} onChange={(event) => { onChange("unit_id", event.target.value); onChange("scs_batch", ""); }}>
                        <option value="">Not Assigned</option>
                        {assignableUnits.map((unit) => <option key={unit.id} value={unit.id}>{getUnitLabel(unit)}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="New Password (optional)">
                      <Input type="password" autoComplete="new-password" placeholder="Keep current password" value={formState.password} onChange={(event) => onChange("password", event.target.value)} />
                    </FormField>
                  </div>
                </section>

                <section className="space-y-4 border-t border-border pt-6">
                  <div>
                    <h3 className="font-medium">Course</h3>
                    <p className="text-sm text-muted-foreground">Batch, course identifiers, and status.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="SCS Batch">
                      <Select value={formState.scs_batch} onChange={(event) => onChange("scs_batch", event.target.value)}>
                        <option value="">Not Assigned</option>
                        {batchOptions.filter((batch) => batch.unit_id === formState.unit_id).map((batch) => <option key={batch.id} value={batch.name}>{batch.name}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Course Code">
                      <Input inputMode="numeric" placeholder="--/--" value={formState.sscc_batch} onChange={(event) => onChange("sscc_batch", formatBatchInput(event.target.value))} />
                    </FormField>
                    <FormField label="NR">
                      <Input inputMode="numeric" value={formState.nr} onChange={(event) => onChange("nr", event.target.value.replace(/\D/g, ""))} />
                    </FormField>
                    <FormField label="OOC (Out of Course)">
                      <OocDateField value={formState.ooc_date} onChange={(value) => onChange("ooc_date", value)} />
                    </FormField>
                  </div>
                </section>

                <section className="space-y-4 border-t border-border pt-6">
                  <div>
                    <h3 className="font-medium">Platoon</h3>
                    <p className="text-sm text-muted-foreground">Course phase assignments.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Common Term Platoon">
                      <Input value={formState.common_term_platoon} onChange={(event) => onChange("common_term_platoon", event.target.value)} />
                    </FormField>
                    <FormField label="Specialisation Phase Platoon">
                      <Input value={formState.specialisation_phase_platoon} onChange={(event) => onChange("specialisation_phase_platoon", event.target.value)} />
                    </FormField>
                  </div>
                </section>
                {errorMessage ? <p role="alert" className="text-sm text-destructive">{errorMessage}</p> : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border bg-card px-5 py-4 sm:flex sm:flex-wrap sm:items-center sm:px-6">
              <Button variant="destructive" onClick={onDelete} disabled={isSaving || isDeleting} className="col-span-2 sm:col-span-1 sm:mr-auto">
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete account"}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>Cancel</Button>
              <Button onClick={onSave} disabled={isSaving || isDeleting}>
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ManageUsersClient({
  initialProfiles,
  batches,
  units,
  defaultUnitId,
}: {
  initialProfiles: EditableProfile[];
  batches: BatchRecord[];
  units: UnitRecord[];
  defaultUnitId?: string;
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [batchOptions, setBatchOptions] = useState(batches);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [batchFilter, setBatchFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProfileFormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStage, setImportStage] = useState<"reading" | "saving" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const batchesById = useMemo(() => Object.fromEntries(batchOptions.map((batch) => [batch.id, batch])), [batchOptions]);
  const unitsById = useMemo(() => Object.fromEntries(units.map((unit) => [unit.id, unit])), [units]);
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
          profile.unit_id && unitsById[profile.unit_id] ? getUnitLabel(unitsById[profile.unit_id]!) : null,
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
      .filter((profile) => !unitFilter || profile.unit_id === unitFilter)
      .filter((profile) => {
        if (!batchFilter) return true;
        return batchFilter === "unassigned" ? !profile.batch_id : profile.batch_id === batchFilter;
      })
      .sort((a, b) => formatProfileName(a, a.email).localeCompare(formatProfileName(b, b.email), undefined, { sensitivity: "base" }));
  }, [batchFilter, batchesById, profiles, roleFilter, searchQuery, unitFilter, unitsById]);
  const editingProfile = editingId ? profiles.find((profile) => profile.id === editingId) ?? null : null;

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
          unit_id: formState.unit_id || null,
          scs_batch: emptyToNull(normalizeBatchName(formState.scs_batch)),
          nr: emptyToNull(formatNr(formState.nr)),
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
    setImportStage("reading");
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
          unit_id: defaultUnitId,
          scs_batch: record.scs_batch ? normalizeBatchName(record.scs_batch) : null,
          nr: formatNr(record.nr) || null,
          sscc_batch: record.sscc_batch ? normalizeBatchName(record.sscc_batch) : null,
          common_term_platoon: record.common_term_platoon || null,
          specialisation_phase_platoon: record.specialisation_phase_platoon || null,
        };
      });
      setImportStage("saving");
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
      const updated = new Map(results.flatMap((result) => (result.status === "updated" && result.profile ? [[result.profile.id, result.profile] as const] : [])));
      setProfiles((current) => [...created, ...current.map((profile) => updated.get(profile.id) ?? profile)]);
      setBatchOptions(payload.batches ?? batchOptions);
    } catch (error) {
      console.error("Failed to import accounts", error);
      setImportError(spreadsheetErrorMessage(error));
    } finally {
      setImporting(false);
      setImportStage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <Card className="min-w-0 overflow-hidden animate-enter-soft">
        <CardHeader className="p-4 sm:p-6">
          <button type="button" className="flex w-full min-w-0 items-start gap-3 text-left sm:items-center" onClick={() => setImportOpen((current) => !current)} aria-expanded={importOpen} aria-controls="account-import-panel">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base leading-snug sm:text-lg">Import accounts from spreadsheet</CardTitle>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">New emails create accounts; existing emails update profile details.</p>
            </div>
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", importOpen && "rotate-180")} />
          </button>
        </CardHeader>
        {importOpen ? <CardContent id="account-import-panel" className="space-y-4 border-t border-border p-5 sm:p-6">
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={downloadImportTemplate}>
              <Download className="h-4 w-4" />
              Download template
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importStage === "reading" ? "Reading spreadsheet..." : importStage === "saving" ? "Updating accounts..." : "Upload spreadsheet"}
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
          {importing ? (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3" role="status" aria-live="polite">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              <div className="min-w-0 text-sm">
                <p className="font-medium">{importStage === "reading" ? "Reading your spreadsheet" : "Creating and updating accounts"}</p>
                <p className="mt-0.5 text-muted-foreground">{importStage === "reading" ? "Checking the columns and preparing each row." : "Please keep this page open. Larger imports can take a moment."}</p>
              </div>
            </div>
          ) : null}
          {importError ? <p className="text-sm text-destructive">{importError}</p> : null}
          {importResults.length ? (
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm">
              <p className="font-medium">
                {importResults.filter((result) => result.status === "created").length} created, {importResults.filter((result) => result.status === "updated").length} updated, {importResults.filter((result) => result.status === "failed").length} failed
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
        </CardContent> : null}
      </Card>

      <Card className="min-w-0 overflow-hidden animate-enter-soft">
        <CardHeader className="p-4 sm:p-6">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="user-search">Search users</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="user-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search users"
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
            <div className="min-w-0 space-y-2">
              <Label htmlFor="role-filter">Role</Label>
              <Select id="role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}>
                <option value="all">All Users</option>
                <option value="admin">Admins</option>
                <option value="user">Non-Admins</option>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="unit-filter">Unit</Label>
              <Select id="unit-filter" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
                <option value="">All Units</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{getUnitLabel(unit)}</option>)}
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
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
            <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">
              {filteredProfiles.length} of {profiles.length} users
            </p>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredProfiles.length ? (
          filteredProfiles.map((profileRow, index) => {
            const batchName = profileRow.batch_id ? batchesById[profileRow.batch_id]?.name ?? "Unknown Batch" : "Not Assigned";
            return (
              <div key={profileRow.id} className={index < 2 ? "animate-enter-soft" : ""}>
                <UserProfileCard
                  profileRow={profileRow}
                  batchName={batchName}
                  batch={profileRow.batch_id ? batchesById[profileRow.batch_id] : null}
                  unitName={profileRow.unit_id && unitsById[profileRow.unit_id] ? getUnitLabel(unitsById[profileRow.unit_id]!) : "Not Assigned"}
                  onEdit={() => startEditing(profileRow)}
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
      <EditUserDialog
        profile={editingProfile}
        batchOptions={batchOptions}
        units={units}
        formState={formState}
        isSaving={savingId === editingId}
        isDeleting={deletingId === editingId}
        errorMessage={saveError ?? undefined}
        onClose={cancelEditing}
        onSave={() => { if (editingId) void saveProfile(editingId); }}
        onDelete={() => { if (editingProfile) void deleteProfile(editingProfile); }}
        onChange={updateForm}
      />
    </>
  );
}
