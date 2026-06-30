"use client";

import { useState } from "react";
import { Edit2, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BatchRecord } from "@/lib/types";

type BatchForm = {
  name: string;
  description: string;
  course_start: string;
  specialisation_phase_start: string;
  course_end: string;
};

const emptyForm: BatchForm = { name: "", description: "", course_start: "", specialisation_phase_start: "", course_end: "" };

function dateInput(value: string | null | undefined) {
  return value?.slice(0, 10) ?? "";
}

function batchForm(batch: BatchRecord): BatchForm {
  return {
    name: batch.name,
    description: batch.description ?? "",
    course_start: dateInput(batch.course_start),
    specialisation_phase_start: dateInput(batch.common_term_end),
    course_end: dateInput(batch.course_end),
  };
}

function BatchFields({ form, setForm }: { form: BatchForm; setForm: (form: BatchForm) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2 sm:col-span-1"><Label>Batch name</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="68/26" /></div>
      <div className="space-y-2 sm:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Optional" /></div>
      <div className="space-y-2"><Label>Course start date</Label><Input required type="date" value={form.course_start} onChange={(event) => setForm({ ...form, course_start: event.target.value })} /></div>
      <div className="space-y-2"><Label>Specialisation phase start date</Label><Input required type="date" value={form.specialisation_phase_start} onChange={(event) => setForm({ ...form, specialisation_phase_start: event.target.value })} /></div>
      <div className="space-y-2"><Label>Course end date</Label><Input required type="date" value={form.course_end} onChange={(event) => setForm({ ...form, course_end: event.target.value })} /></div>
    </div>
  );
}

export function ManageBatchesClient({ initialBatches }: { initialBatches: BatchRecord[] }) {
  const [batches, setBatches] = useState(initialBatches);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BatchForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function payload() {
    return {
      ...form,
      description: form.description.trim() || null,
      course_start: form.course_start || null,
      specialisation_phase_start: form.specialisation_phase_start || null,
      course_end: form.course_end || null,
    };
  }

  async function save() {
    if (!form.name.trim() || !form.course_start || !form.specialisation_phase_start || !form.course_end) {
      setError("Set a batch name and all three course dates.");
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
      setForm(emptyForm);
    } catch (saveError) {
      console.error("Could not save batch", saveError);
      setError(saveError instanceof Error ? saveError.message : "The batch could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() { setCreating(false); setEditingId(null); setForm(emptyForm); setError(null); }

  return (
    <div className="grid gap-4">
      {!creating && !editingId ? <Button className="w-fit" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Add batch</Button> : null}
      {creating ? (
        <Card><CardHeader><CardTitle>Add batch</CardTitle></CardHeader><CardContent className="space-y-4"><BatchFields form={form} setForm={setForm} />{error ? <p className="text-sm text-destructive">{error}</p> : null}<div className="flex justify-end gap-2"><Button variant="outline" onClick={cancel}><X className="h-4 w-4" />Cancel</Button><Button onClick={() => void save()} disabled={saving}><Save className="h-4 w-4" />{saving ? "Saving..." : "Save batch"}</Button></div></CardContent></Card>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {batches.map((batch) => {
          const editing = editingId === batch.id;
          return <Card key={batch.id} className="overflow-hidden"><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>{batch.name}</CardTitle>{batch.description ? <p className="mt-1 text-sm text-muted-foreground">{batch.description}</p> : null}</div>{!editing ? <Button size="sm" variant="outline" onClick={() => { setEditingId(batch.id); setCreating(false); setForm(batchForm(batch)); setError(null); }}><Edit2 className="h-4 w-4" />Edit</Button> : null}</CardHeader><CardContent className="space-y-4">{editing ? <><BatchFields form={form} setForm={setForm} />{error ? <p className="text-sm text-destructive">{error}</p> : null}<div className="flex justify-end gap-2"><Button variant="outline" onClick={cancel}>Cancel</Button><Button onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button></div></> : <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"><div><p className="text-muted-foreground">Course start</p><p>{dateInput(batch.course_start) || "Not set"}</p></div><div><p className="text-muted-foreground">Specialisation starts</p><p>{dateInput(batch.common_term_end) || "Not set"}</p></div><div><p className="text-muted-foreground">Course end</p><p>{dateInput(batch.course_end) || "Not set"}</p></div></div>}</CardContent></Card>;
        })}
      </div>
    </div>
  );
}
