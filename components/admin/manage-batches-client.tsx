"use client";

import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Edit2, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDisplayDate } from "@/lib/display-date";
import type { BatchRecord, UnitRecord } from "@/lib/types";
import { getUnitLabel } from "@/lib/unit-scope";

type BatchForm = {
  unit_id: string;
  name: string;
  course_start: string;
  specialisation_phase_start: string;
  course_end: string;
};

const emptyForm: BatchForm = { unit_id: "", name: "", course_start: "", specialisation_phase_start: "", course_end: "" };

function dateInput(value: string | null | undefined) {
  return value?.slice(0, 10) ?? "";
}

function batchForm(batch: BatchRecord): BatchForm {
  return {
    unit_id: batch.unit_id,
    name: batch.name,
    course_start: dateInput(batch.course_start),
    specialisation_phase_start: dateInput(batch.common_term_end),
    course_end: dateInput(batch.course_end),
  };
}

function BatchDateField({
  label,
  value,
  onChange,
  align = "start",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const parsedDate = value ? parseISO(value) : undefined;
  const selectedDate = parsedDate && isValid(parsedDate) ? parsedDate : undefined;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-start px-4 text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            {selectedDate ? formatDisplayDate(selectedDate) : "Select a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          className="z-[70] w-[20rem] max-w-[calc(100vw-2rem)] bg-popover p-4 opacity-100 shadow-xl"
        >
          <Calendar
            selected={selectedDate}
            disableFuture={false}
            initialFocus
            onSelect={(date) => {
              if (!date) return;
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function BatchFields({ form, setForm, units }: { form: BatchForm; setForm: (form: BatchForm) => void; units: UnitRecord[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2 sm:col-span-3">
        <Label>Unit</Label>
        <Select value={form.unit_id} onChange={(event) => setForm({ ...form, unit_id: event.target.value })}>
          <option value="">Select unit</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{getUnitLabel(unit)}</option>)}
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-3">
        <Label>SCS Batch</Label>
        <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="68/26" />
      </div>
      <BatchDateField label="Course Start" value={form.course_start} onChange={(value) => setForm({ ...form, course_start: value })} />
      <BatchDateField label="Spec Phase Start" value={form.specialisation_phase_start} onChange={(value) => setForm({ ...form, specialisation_phase_start: value })} />
      <BatchDateField label="Course End" value={form.course_end} align="end" onChange={(value) => setForm({ ...form, course_end: value })} />
    </div>
  );
}

export function ManageBatchesClient({
  initialBatches,
  units,
  defaultUnitId,
}: {
  initialBatches: BatchRecord[];
  units: UnitRecord[];
  defaultUnitId?: string | null;
}) {
  const [batches, setBatches] = useState(initialBatches);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BatchForm>({ ...emptyForm, unit_id: defaultUnitId ?? "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function payload() {
    return {
      ...form,
      course_start: form.course_start || null,
      specialisation_phase_start: form.specialisation_phase_start || null,
      course_end: form.course_end || null,
    };
  }

  async function save() {
    if (!form.unit_id || !form.name.trim() || !form.course_start || !form.specialisation_phase_start || !form.course_end) {
      setError("Select a unit and set a batch name and all three course dates.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/batches", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload(), ...(editingId ? { id: editingId } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "The batch could not be saved.");
      const saved = result.batch as BatchRecord;
      setBatches((current) => [saved, ...current.filter((batch) => batch.id !== saved.id)]);
      setCreating(false);
      setEditingId(null);
      setForm({ ...emptyForm, unit_id: defaultUnitId ?? "" });
    } catch (saveError) {
      console.error("Could not save batch", saveError);
      setError(saveError instanceof Error ? saveError.message : "The batch could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() { setCreating(false); setEditingId(null); setForm({ ...emptyForm, unit_id: defaultUnitId ?? "" }); setError(null); }

  async function deleteBatch(batch: BatchRecord) {
    if (!window.confirm(`Delete ${batch.name}? Users assigned to this batch will become unassigned.`)) return;
    setDeletingId(batch.id);
    setError(null);
    try {
      const response = await fetch("/api/admin/batches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: batch.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "This batch could not be deleted.");
      setBatches((current) => current.filter((item) => item.id !== batch.id));
      cancel();
    } catch (deleteError) {
      console.error("Could not delete batch", deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "This batch could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-4">
      {!creating && !editingId ? <Button className="w-fit" onClick={() => { setForm({ ...emptyForm, unit_id: defaultUnitId ?? "" }); setCreating(true); }}><Plus className="h-4 w-4" />Add batch</Button> : null}
      {creating ? (
        <Card><CardHeader><CardTitle>Add batch</CardTitle></CardHeader><CardContent className="space-y-4"><BatchFields form={form} setForm={setForm} units={units} />{error ? <p className="text-sm text-destructive">{error}</p> : null}<div className="flex justify-end gap-2"><Button variant="outline" onClick={cancel}><X className="h-4 w-4" />Cancel</Button><Button onClick={() => void save()} disabled={saving}><Save className="h-4 w-4" />{saving ? "Saving..." : "Save batch"}</Button></div></CardContent></Card>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {batches.map((batch) => {
          const editing = editingId === batch.id;
          const batchUnit = units.find((unit) => unit.id === batch.unit_id);
          return <Card key={batch.id} className="overflow-visible"><CardHeader className="flex-row items-start justify-between gap-4"><CardTitle>{batch.name} SSCC</CardTitle>{!editing ? <Button size="sm" variant="outline" onClick={() => { setEditingId(batch.id); setCreating(false); setForm(batchForm(batch)); setError(null); }}><Edit2 className="h-4 w-4" />Edit</Button> : null}</CardHeader><CardContent className="space-y-4">{editing ? <><BatchFields form={form} setForm={setForm} units={units} />{error ? <p className="text-sm text-destructive">{error}</p> : null}<div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4"><Button variant="destructive" className="mr-auto" onClick={() => void deleteBatch(batch)} disabled={saving || deletingId === batch.id}><Trash2 className="h-4 w-4" />{deletingId === batch.id ? "Deleting..." : "Delete batch"}</Button><Button variant="outline" onClick={cancel} disabled={saving || deletingId === batch.id}>Cancel</Button><Button onClick={() => void save()} disabled={saving || deletingId === batch.id}>{saving ? "Saving..." : "Save changes"}</Button></div></> : <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"><div><p className="text-muted-foreground">Unit</p><p>{batchUnit ? getUnitLabel(batchUnit) : "Unknown"}</p></div><div><p className="text-muted-foreground">Course Start</p><p>{dateInput(batch.course_start) || "Not set"}</p></div><div><p className="text-muted-foreground">Spec Phase Start</p><p>{dateInput(batch.common_term_end) || "Not set"}</p></div><div><p className="text-muted-foreground">Course End</p><p>{dateInput(batch.course_end) || "Not set"}</p></div></div>}</CardContent></Card>;
        })}
      </div>
    </div>
  );
}
