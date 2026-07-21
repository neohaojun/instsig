"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Copy, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { StrengthCard } from "@/components/dashboard/strength-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatProfileName } from "@/lib/profile-display";
import { buildStrengthMessage, type StrengthMessageKind } from "@/lib/strength-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProfileRecord, StrengthManualCategory, StrengthManualRecord } from "@/lib/types";
import type { StrengthCategoryEntry, StrengthCategoryKey, StrengthDetails } from "@/lib/strength-summary";

const categoryCards: {
  key: StrengthCategoryKey;
  title: string;
  emptyText: string;
  dotClassName: string;
  manualCategory?: StrengthManualCategory;
}[] = [
  { key: "attendC", title: "Attend C", emptyText: "No personnel on MC.", dotClassName: "bg-red-500" },
  { key: "attendB", title: "Attend B", emptyText: "No personnel on status.", dotClassName: "bg-amber-500" },
  { key: "reportingSick", title: "Reporting Sick", emptyText: "No one reporting sick.", dotClassName: "bg-yellow-500" },
  { key: "externalAppointment", title: "External Appt", emptyText: "No external appointments.", dotClassName: "bg-orange-500" },
  { key: "guardDuty", title: "Guard Duty", emptyText: "No guard duty.", dotClassName: "bg-zinc-400", manualCategory: "guard_duty" },
  {
    key: "onMedication",
    title: "On Medication",
    emptyText: "No personnel on medication.",
    dotClassName: "bg-zinc-400",
    manualCategory: "on_medication",
  },
  { key: "others", title: "Others", emptyText: "No other absences.", dotClassName: "bg-zinc-400", manualCategory: "others" },
];

const manualCategoryLabels: Record<StrengthManualCategory, string> = {
  guard_duty: "Guard Duty",
  on_medication: "On Medication",
  others: "Others",
  stay_in_perm_staff: "NSF Perm Staff Staying In",
};

function StrengthPersonRow({
  entry,
  profilesById,
  canRemove = false,
  onRemove,
}: {
  entry: StrengthCategoryEntry;
  profilesById: Record<string, ProfileRecord | null | undefined>;
  canRemove?: boolean;
  onRemove?: (entry: StrengthCategoryEntry) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-card-foreground">
          {formatProfileName(profilesById[entry.profileId], entry.fallbackName)}
        </p>
        {canRemove && onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${formatProfileName(profilesById[entry.profileId], entry.fallbackName)}`}
            onClick={() => onRemove(entry)}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
      <p className="mt-2 text-xs uppercase text-muted-foreground">{entry.meta}</p>
    </div>
  );
}

export function StrengthDetail({
  details,
  profilesById,
  selectedDate,
  onManualRecordAdded,
  onManualRecordRemoved,
  showSummaryTitle = true,
}: {
  details: StrengthDetails;
  profilesById: Record<string, ProfileRecord | null | undefined>;
  selectedDate: string;
  onManualRecordAdded?: (record: StrengthManualRecord) => void;
  onManualRecordRemoved?: (recordId: string) => void;
  showSummaryTitle?: boolean;
}) {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState("overall");
  const [addCategory, setAddCategory] = useState<StrengthManualCategory | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copiedKind, setCopiedKind] = useState<StrengthMessageKind | null>(null);
  const [isPending, startTransition] = useTransition();
  const platoonTabs = details.batches.flatMap((batch) =>
    batch.platoons
      .filter((platoon) => platoon.name !== "Not set")
      .map((platoon) => ({
        id: `${batch.id}:${platoon.name}`,
        label: platoon.name,
        profileIds: new Set(platoon.profileIds),
        summary: platoon.summary,
      })),
  );
  const selectedPlatoon = platoonTabs.find((tab) => tab.id === selectedTab);
  const visibleSummary = selectedPlatoon?.summary ?? details.summary;
  const activeProfileIds = useMemo(
    () => new Set(details.batches.flatMap((batch) => batch.platoons.flatMap((platoon) => platoon.profileIds))),
    [details.batches],
  );
  const personnelOptions = useMemo(
    () =>
      Object.values(profilesById)
        .filter((profile): profile is ProfileRecord => Boolean(profile && profile.role !== "admin" && activeProfileIds.has(profile.id)))
        .sort((first, second) => formatProfileName(first, first.email).localeCompare(formatProfileName(second, second.email))),
    [activeProfileIds, profilesById],
  );
  const permStaffOptions = useMemo(
    () =>
      Object.values(profilesById)
        .filter((profile): profile is ProfileRecord => Boolean(profile && profile.role !== "admin" && !activeProfileIds.has(profile.id)))
        .sort((first, second) => formatProfileName(first, first.email).localeCompare(formatProfileName(second, second.email))),
    [activeProfileIds, profilesById],
  );
  const dialogOptions = addCategory === "stay_in_perm_staff" ? permStaffOptions : personnelOptions;

  useEffect(() => {
    if (!addCategory) return;
    setSelectedProfileId((current) => (current && dialogOptions.some((profile) => profile.id === current) ? current : dialogOptions[0]?.id ?? ""));
  }, [addCategory, dialogOptions]);

  function openAddDialog(category: StrengthManualCategory) {
    setAddCategory(category);
    const options = category === "stay_in_perm_staff" ? permStaffOptions : personnelOptions;
    setSelectedProfileId(options[0]?.id ?? "");
    setNote("");
    setMessage(null);
  }

  async function handleCopyMessage(kind: StrengthMessageKind) {
    const text = buildStrengthMessage({
      kind,
      selectedDate,
      details,
      profilesById,
      permStaffTotal: permStaffOptions.length,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(null);
      setCopiedKind(kind);
      window.setTimeout(() => setCopiedKind((current) => (current === kind ? null : current)), 2000);
    } catch (error) {
      console.error("Failed to copy strength message", error);
      setCopyMessage("Could not copy the message. Try again.");
    }
  }

  function handleAddRecord() {
    const selectedProfile = profilesById[selectedProfileId];
    if (!addCategory || !selectedProfileId || !selectedProfile?.unit_id) {
      setMessage("Select a person before saving.");
      return;
    }

    startTransition(() => {
      void (async () => {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("strength_records")
          .upsert(
            {
              unit_id: selectedProfile.unit_id,
              category: addCategory,
              profile_id: selectedProfileId,
              duty_date: selectedDate,
              note: note.trim() || null,
            },
            { onConflict: "category,profile_id,duty_date" },
          )
          .select()
          .single();

        if (error || !data) {
          console.error("Failed to save strength record", error);
          setMessage("Could not save the record. Try again.");
          return;
        }

        onManualRecordAdded?.(data as StrengthManualRecord);
        if (!onManualRecordAdded) router.refresh();
        setAddCategory(null);
        setNote("");
        setMessage(null);
      })();
    });
  }

  function handleRemoveRecord(entry: StrengthCategoryEntry) {
    startTransition(() => {
      void (async () => {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.from("strength_records").delete().eq("id", entry.id);

        if (error) {
          console.error("Failed to remove strength record", error);
          setMessage("Could not remove the record. Try again.");
          return;
        }

        onManualRecordRemoved?.(entry.id);
        if (!onManualRecordRemoved) router.refresh();
      })();
    });
  }

  return (
    <div className="grid gap-6">
      {showSummaryTitle ? <StrengthCard summary={details.summary} /> : null}
      {!showSummaryTitle ? (
        <div className="rounded-2xl border border-border bg-card p-8 animate-enter-soft">
          <p className="mb-4 text-sm font-medium text-muted-foreground">
            {details.summary.activeBatches.length
              ? `${details.summary.activeBatches.join(", ")} SSCC`
              : "No active batch for the selected date"}
          </p>
          {platoonTabs.length ? (
            <div className="mb-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted p-1" role="tablist" aria-label="Strength by platoon">
              {[{ id: "overall", label: "Overall" }, ...platoonTabs].map((tab) => {
                const active = (selectedPlatoon?.id ?? "overall") === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedTab(tab.id)}
                    className={cn(
                      "shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                      active && "bg-background text-foreground shadow-sm",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-3xl font-bold leading-none text-foreground">{visibleSummary.total}</p>
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Current</p>
                <p className="text-3xl font-bold leading-none text-emerald-500">{visibleSummary.current}</p>
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Attend C</p>
                <p className="text-3xl font-bold leading-none text-red-500">{visibleSummary.attendC}</p>
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Attend B</p>
                <p className="text-3xl font-bold leading-none text-amber-500">{visibleSummary.attendB}</p>
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Reporting Sick</p>
                <p className="text-3xl font-bold leading-none text-yellow-500">{visibleSummary.reportingSick}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-6 lg:grid-cols-4">
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">External Appt</p>
                <p className="text-3xl font-bold leading-none text-orange-500">{visibleSummary.externalAppointment}</p>
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Guard Duty</p>
                <p className="text-3xl font-bold leading-none text-foreground">{visibleSummary.guardDuty}</p>
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">On Medication</p>
                <p className="text-3xl font-bold leading-none text-foreground">{visibleSummary.onMedication}</p>
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Others</p>
                <p className="text-3xl font-bold leading-none text-foreground">{visibleSummary.others}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <Card className="animate-enter-soft">
        <CardHeader className="p-6 pb-3">
          <CardTitle className="text-xl">SIDO Messages</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-6 pt-3 sm:grid-cols-2">
          {(["book-in", "stay-in"] as const).map((kind) => (
            <Button key={kind} type="button" variant="outline" className="justify-start" onClick={() => void handleCopyMessage(kind)}>
              {copiedKind === kind ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copiedKind === kind ? "Copied" : `Copy ${kind === "book-in" ? "Book-In" : "Stay-In"} Message`}
            </Button>
          ))}
          {copyMessage ? <p className="text-sm text-destructive sm:col-span-2">{copyMessage}</p> : null}
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        {categoryCards.map((card) => {
          const entries = details.categories[card.key].filter(
            (entry) => card.key === "stayInPermStaff" || !selectedPlatoon || selectedPlatoon.profileIds.has(entry.profileId),
          );
          const manualCategory = card.manualCategory;

          return (
            <Card key={card.key} className="overflow-hidden animate-enter-soft">
              <CardHeader className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex min-w-0 items-center gap-3 text-xl">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${card.dotClassName}`} />
                    <span className="truncate">
                      {card.title} ({entries.length})
                    </span>
                  </CardTitle>
                  {manualCategory ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => openAddDialog(manualCategory)}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 p-6 pt-0">
                {entries.length ? (
                  entries.map((entry) => (
                    <StrengthPersonRow
                      key={entry.id}
                      entry={entry}
                      profilesById={profilesById}
                      canRemove={Boolean(manualCategory)}
                      onRemove={manualCategory ? handleRemoveRecord : undefined}
                    />
                  ))
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">{card.emptyText}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Dialog open={Boolean(addCategory)} onOpenChange={(open) => !open && setAddCategory(null)}>
        <DialogContent className="max-w-lg" aria-labelledby="strength-record-title">
          <div className="space-y-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="strength-record-title" className="text-xl font-semibold text-card-foreground">
                  Add {addCategory ? manualCategoryLabels[addCategory] : "Record"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedDate}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-2" onClick={() => setAddCategory(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="strength-person">Person</Label>
                <Select
                  id="strength-person"
                  value={selectedProfileId}
                  onChange={(event) => setSelectedProfileId(event.target.value)}
                  disabled={!dialogOptions.length || isPending}
                >
                  {dialogOptions.length ? (
                    dialogOptions.map((person) => (
                      <option key={person.id} value={person.id}>
                        {formatProfileName(person, person.email)}
                      </option>
                    ))
                  ) : (
                    <option value="">No eligible personnel</option>
                  )}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="strength-note">Note</Label>
                <Textarea
                  id="strength-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional detail"
                  disabled={isPending}
                />
              </div>
              {message ? <p className="text-sm text-destructive">{message}</p> : null}
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setAddCategory(null)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="button" onClick={handleAddRecord} disabled={!dialogOptions.length || isPending}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
