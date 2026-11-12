"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Drawer from "@/components/Drawer";
import { useDialog } from "@/components/dialogs";
import { Button, Field, TextArea, TextInput } from "@/components/ui";
import { fmtDateTime, fromLocalInput, toLocalInput } from "@/lib/dates";
import { ClientApiError, errorMessage } from "@/lib/api";
import { useCollection } from "@/lib/store";
import { BP_RANGE, hasErrors, LIMITS, validateBp, type BpInput, type Errors } from "@/lib/validation";
import type { BpRecord } from "@/lib/types";

const empty = (): BpInput => ({ measuredAt: toLocalInput(Date.now()), systolic: "", diastolic: "", pulse: "", note: "" });

/** 血壓新增／修改（F7）；由父層條件渲染並給 key */
export default function BpDrawer({ record, onClose }: { record: BpRecord | null; onClose: () => void }) {
  const [, api] = useCollection("bp");
  const dialog = useDialog();
  const [form, setForm] = useState<BpInput>(() => record
    ? { measuredAt: toLocalInput(record.measuredAt), systolic: String(record.systolic), diastolic: String(record.diastolic), pulse: record.pulse == null ? "" : String(record.pulse), note: record.note }
    : empty());
  const [errors, setErrors] = useState<Errors<keyof BpInput>>({});
  const [nowInput] = useState(() => toLocalInput(Date.now()));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof BpInput>(k: K, v: BpInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    // datetime-local 一律以台北時間解讀
    const at = form.measuredAt ? fromLocalInput(form.measuredAt) : "";
    const e = validateBp({ ...form, measuredAt: at });
    setErrors(e);
    if (hasErrors(e)) {
      await dialog.notify({ ok: false, title: "儲存失敗", message: "有欄位未通過檢查，請依紅字修正後重新儲存。" });
      return;
    }
    const row = {
      measuredAt: at, systolic: Number(form.systolic), diastolic: Number(form.diastolic),
      pulse: form.pulse.trim() ? Number(form.pulse) : null, note: form.note.trim(),
    };
    // 2026/11/12 - Arlen - 改呼叫 API；後端的欄位錯誤直接顯示成紅字 - Start
    setSaving(true);
    try {
      if (record) await api.update(record.id, row);
      else await api.add(row);
    } catch (err) {
      if (err instanceof ClientApiError) setErrors(err.fields as Errors<keyof BpInput>);
      await dialog.notify({ ok: false, title: "儲存失敗", message: errorMessage(err) });
      return;
    } finally {
      setSaving(false);
    }
    // 2026/11/12 - Arlen - 改呼叫 API - end
    await dialog.notify({ ok: true, title: "已儲存", message: `${fmtDateTime(at)} 血壓 ${row.systolic}/${row.diastolic} 已儲存。` });
    onClose();
  };

  const handleDelete = async () => {
    if (!record) return;
    if (!(await dialog.confirmDelete({ target: `${fmtDateTime(record.measuredAt)} 血壓 ${record.systolic}/${record.diastolic}` }))) return;
    try {
      await api.remove(record.id);
    } catch (err) {
      await dialog.notify({ ok: false, title: "刪除失敗", message: errorMessage(err) });
      return;
    }
    await dialog.notify({ ok: true, title: "已刪除", message: "血壓紀錄已刪除。" });
    onClose();
  };

  const num = (k: "systolic" | "diastolic" | "pulse", label: string, required: boolean) => (
    <Field label={label} required={required} htmlFor={`bp-${k}`} error={errors[k]} hint={`${BP_RANGE[k][0]}~${BP_RANGE[k][1]}`}>
      <TextInput id={`bp-${k}`} inputMode="numeric" maxLength={3} value={form[k]} invalid={!!errors[k]}
        onChange={(e) => set(k, e.target.value.replace(/\D/g, ""))} data-testid={`bp-${k}-input`} />
    </Field>
  );

  return (
    <Drawer
      open
      title={record ? "修改血壓" : "新增血壓"}
      onClose={onClose}
      testId="bp-drawer"
      footer={
        <>
          {record && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={handleDelete} data-testid="bp-delete-btn">
              <Trash2 size={18} strokeWidth={1.75} aria-hidden />刪除
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} data-testid="bp-cancel-btn">取消</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="bp-save-btn">{saving ? "儲存中…" : "儲存"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Field label="量測時間" required htmlFor="bp-measuredAt" error={errors.measuredAt}>
          <TextInput id="bp-measuredAt" type="datetime-local" value={form.measuredAt} max={nowInput}
            invalid={!!errors.measuredAt} onChange={(e) => set("measuredAt", e.target.value)} data-testid="bp-measuredAt-input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {num("systolic", "收縮壓", true)}
          {num("diastolic", "舒張壓", true)}
        </div>
        {num("pulse", "脈搏", false)}
        <Field label="備註" htmlFor="bp-note" error={errors.note} hint="加密儲存">
          <TextArea id="bp-note" value={form.note} maxLength={LIMITS.note} rows={3} onChange={(e) => set("note", e.target.value)} data-testid="bp-note-input" />
        </Field>
      </div>
    </Drawer>
  );
}
