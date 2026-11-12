"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import Drawer from "@/components/Drawer";
import { useDialog } from "@/components/dialogs";
import { Button, Field, TextArea, TextInput } from "@/components/ui";
import { fmtDateTime, fromLocalInput, toLocalInput } from "@/lib/dates";
import { newId, useCollection } from "@/lib/store";
import { hasErrors, LIMITS, validateMed, type Errors, type MedInput } from "@/lib/validation";
import type { MedRecord } from "@/lib/types";

const empty = (): MedInput => ({ takenAt: toLocalInput(Date.now()), drug: "", dose: "", note: "" });

/** 吃藥新增／修改（F9）；藥名用 datalist 提示曾經輸入過的藥名 */
export default function MedDrawer({ record, onClose }: { record: MedRecord | null; onClose: () => void }) {
  const [all, api] = useCollection("med");
  const dialog = useDialog();
  const [form, setForm] = useState<MedInput>(() =>
    record ? { takenAt: toLocalInput(record.takenAt), drug: record.drug, dose: record.dose, note: record.note } : empty());
  const [errors, setErrors] = useState<Errors<keyof MedInput>>({});
  const [nowInput] = useState(() => toLocalInput(Date.now()));

  const drugs = useMemo(() => [...new Set((all ?? []).map((m) => m.drug))].sort(), [all]);

  const set = <K extends keyof MedInput>(k: K, v: MedInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const at = form.takenAt ? fromLocalInput(form.takenAt) : "";
    const e = validateMed({ ...form, takenAt: at });
    setErrors(e);
    if (hasErrors(e)) {
      await dialog.notify({ ok: false, title: "儲存失敗", message: "有欄位未通過檢查，請依紅字修正後重新儲存。" });
      return;
    }
    const row = { takenAt: at, drug: form.drug.trim(), dose: form.dose.trim(), note: form.note.trim() };
    if (record) api.update(record.id, row);
    else api.add({ ...row, id: newId() });
    await dialog.notify({ ok: true, title: "已儲存", message: `${fmtDateTime(at)} ${row.drug} ${row.dose} 已儲存。` });
    onClose();
  };

  const handleDelete = async () => {
    if (!record) return;
    if (!(await dialog.confirmDelete({ target: `${fmtDateTime(record.takenAt)} ${record.drug} ${record.dose}` }))) return;
    api.remove(record.id);
    await dialog.notify({ ok: true, title: "已刪除", message: "吃藥紀錄已刪除。" });
    onClose();
  };

  return (
    <Drawer
      open
      title={record ? "修改吃藥紀錄" : "新增吃藥紀錄"}
      onClose={onClose}
      testId="med-drawer"
      footer={
        <>
          {record && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={handleDelete} data-testid="med-delete-btn">
              <Trash2 size={18} strokeWidth={1.75} aria-hidden />刪除
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} data-testid="med-cancel-btn">取消</Button>
          <Button onClick={handleSave} data-testid="med-save-btn">儲存</Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Field label="服藥時間" required htmlFor="med-takenAt" error={errors.takenAt}>
          <TextInput id="med-takenAt" type="datetime-local" value={form.takenAt} max={nowInput}
            invalid={!!errors.takenAt} onChange={(e) => set("takenAt", e.target.value)} data-testid="med-takenAt-input" />
        </Field>
        <Field label="藥名" required htmlFor="med-drug" error={errors.drug} hint="會提示以前輸入過的藥名">
          <TextInput id="med-drug" list="med-drug-list" value={form.drug} maxLength={LIMITS.drug} invalid={!!errors.drug}
            onChange={(e) => set("drug", e.target.value)} placeholder="例：降血壓藥" data-testid="med-drug-input" />
          <datalist id="med-drug-list">{drugs.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
        <Field label="劑量" required htmlFor="med-dose" error={errors.dose}>
          <TextInput id="med-dose" value={form.dose} maxLength={LIMITS.dose} invalid={!!errors.dose}
            onChange={(e) => set("dose", e.target.value)} placeholder="例：1 顆、5 mg、半顆" data-testid="med-dose-input" />
        </Field>
        <Field label="備註" htmlFor="med-note" error={errors.note} hint="正式版加密儲存">
          <TextArea id="med-note" value={form.note} maxLength={LIMITS.note} rows={3} onChange={(e) => set("note", e.target.value)} data-testid="med-note-input" />
        </Field>
      </div>
    </Drawer>
  );
}
