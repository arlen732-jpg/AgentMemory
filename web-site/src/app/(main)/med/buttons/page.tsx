"use client";

// 2026/11/12 - Arlen - 吃藥按鈕設定：首頁的一鍵吃藥按鈕依這裡的設定產生
import { useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { useDialog } from "@/components/dialogs";
import { Button, Card, EmptyState, Field, PageHeader, Skeleton, TextInput } from "@/components/ui";
import { ClientApiError, errorMessage } from "@/lib/api";
import { useCollection } from "@/lib/store";
import type { MedButton, MedButtonDrug } from "@/lib/types";
import { LIMITS } from "@/lib/validation";

type Form = { name: string; sort: string; drugs: MedButtonDrug[] };
type FieldErrors = { name?: string; sort?: string; drugs?: string };

/** 前端先檢查；後端會再檢查一次 */
function check(f: Form, all: MedButton[], excludeId?: string): FieldErrors {
  const e: FieldErrors = {};
  const name = f.name.trim();
  if (!name) e.name = "請輸入按鈕名稱";
  else if (all.some((b) => b.id !== excludeId && b.name === name)) e.name = `按鈕「${name}」已存在`;
  if (f.sort.trim() && !/^\d{1,3}$/.test(f.sort.trim())) e.sort = "順序請填 0～999 的整數";
  const bad = f.drugs.findIndex((d) => !d.drug.trim() || !d.dose.trim());
  if (bad >= 0) e.drugs = `第 ${bad + 1} 種藥的藥名與劑量都要填`;
  return e;
}

const toBody = (f: Form) => ({
  name: f.name.trim(),
  sort: f.sort.trim() || "0",
  drugs: f.drugs.map((d) => ({ drug: d.drug.trim(), dose: d.dose.trim() })),
});

function ButtonCard({ button, all }: { button: MedButton; all: MedButton[] }) {
  const [, api] = useCollection("medButtons");
  const dialog = useDialog();
  const [form, setForm] = useState<Form>(() => ({ name: button.name, sort: String(button.sort), drugs: button.drugs.map((d) => ({ ...d })) }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const setDrug = (i: number, k: keyof MedButtonDrug, v: string) =>
    setForm((f) => ({ ...f, drugs: f.drugs.map((d, j) => (j === i ? { ...d, [k]: v } : d)) }));

  const handleSave = async () => {
    const e = check(form, all, button.id);
    setErrors(e);
    if (Object.keys(e).length) {
      await dialog.notify({ ok: false, title: "儲存失敗", message: "有欄位未通過檢查，請依紅字修正後重新儲存。" });
      return;
    }
    setSaving(true);
    try {
      await api.update(button.id, toBody(form));
    } catch (err) {
      if (err instanceof ClientApiError) setErrors((err.fields ?? {}) as FieldErrors);
      await dialog.notify({ ok: false, title: "儲存失敗", message: errorMessage(err) });
      return;
    } finally {
      setSaving(false);
    }
    await dialog.notify({ ok: true, title: "已儲存", message: `按鈕「${form.name.trim()}」已儲存，首頁會依新藥單記錄。` });
  };

  const handleDelete = async () => {
    if (!(await dialog.confirmDelete({ target: `吃藥按鈕「${button.name}」` }))) return;
    try {
      await api.remove(button.id);
    } catch (err) {
      await dialog.notify({ ok: false, title: "刪除失敗", message: errorMessage(err) });
      return;
    }
    await dialog.notify({ ok: true, title: "已刪除", message: `吃藥按鈕「${button.name}」已刪除，已記錄的吃藥紀錄不受影響。` });
  };

  return (
    <div data-testid="med-button-card"><Card>
      <div className="grid gap-x-4 sm:grid-cols-[1fr_7rem]">
        <Field label="按鈕名稱" required htmlFor={`mb-name-${button.id}`} error={errors.name}>
          <TextInput id={`mb-name-${button.id}`} value={form.name} maxLength={LIMITS.medButtonName} invalid={!!errors.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="med-button-name-input" />
        </Field>
        <Field label="順序" htmlFor={`mb-sort-${button.id}`} error={errors.sort}>
          <TextInput id={`mb-sort-${button.id}`} value={form.sort} maxLength={3} inputMode="numeric" invalid={!!errors.sort}
            onChange={(e) => setForm({ ...form, sort: e.target.value })} data-testid="med-button-sort-input" />
        </Field>
      </div>

      <p className="mb-2 text-sm font-medium text-fg">藥單</p>
      {form.drugs.length === 0 && <p className="mb-2 text-sm text-fg-muted">還沒有藥，首頁的這顆按鈕會停用。</p>}
      <div className="flex flex-col gap-2">
        {form.drugs.map((d, i) => (
          <div key={i} className="flex items-center gap-2" data-testid="med-button-drug-row">
            <TextInput value={d.drug} maxLength={LIMITS.drug} placeholder="藥名" aria-label={`第 ${i + 1} 種藥的藥名`}
              onChange={(e) => setDrug(i, "drug", e.target.value)} data-testid="med-button-drug-input" />
            <TextInput value={d.dose} maxLength={LIMITS.dose} placeholder="劑量，例：1 顆" aria-label={`第 ${i + 1} 種藥的劑量`}
              className="w-36" onChange={(e) => setDrug(i, "dose", e.target.value)} data-testid="med-button-dose-input" />
            <Button variant="ghost" aria-label={`移除第 ${i + 1} 種藥`}
              onClick={() => setForm({ ...form, drugs: form.drugs.filter((_, j) => j !== i) })} data-testid="med-button-drug-remove-btn">
              <X size={16} aria-hidden />
            </Button>
          </div>
        ))}
      </div>
      {errors.drugs && <p className="mt-1 text-xs text-danger">{errors.drugs}</p>}
      <Button variant="secondary" className="mt-2" disabled={form.drugs.length >= LIMITS.medButtonDrugs}
        onClick={() => setForm({ ...form, drugs: [...form.drugs, { drug: "", dose: "" }] })} data-testid="med-button-drug-add-btn">
        <Plus size={16} aria-hidden />加一種藥
      </Button>

      <div className="mt-4 flex justify-between border-t border-neutral-100 pt-4">
        <Button variant="ghost" className="text-danger" onClick={handleDelete} data-testid="med-button-delete-btn">
          <Trash2 size={16} strokeWidth={1.75} aria-hidden />刪除
        </Button>
        <Button onClick={handleSave} disabled={saving} data-testid="med-button-save-btn">
          <Save size={16} strokeWidth={1.75} aria-hidden />{saving ? "儲存中…" : "儲存"}
        </Button>
      </div>
    </Card></div>
  );
}

export default function MedButtonsPage() {
  const [buttons, api] = useCollection("medButtons");
  const dialog = useDialog();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const all = buttons ?? [];
    const e = check({ name, sort: "", drugs: [] }, all).name;
    setError(e);
    if (e) {
      await dialog.notify({ ok: false, title: "新增失敗", message: "有欄位未通過檢查，請依紅字修正後重新送出。" });
      return;
    }
    const sort = String(Math.min(999, all.reduce((m, b) => Math.max(m, b.sort), 0) + 1));
    setSaving(true);
    try {
      await api.add({ name: name.trim(), sort, drugs: [] });
    } catch (err) {
      if (err instanceof ClientApiError) setError(err.fields?.name);
      await dialog.notify({ ok: false, title: "新增失敗", message: errorMessage(err) });
      return;
    } finally {
      setSaving(false);
    }
    await dialog.notify({ ok: true, title: "已新增", message: `按鈕「${name.trim()}」已新增，請在下方填入藥單。` });
    setName("");
  };

  return (
    <>
      <PageHeader title="吃藥按鈕設定" description="首頁會依這裡的設定顯示吃藥按鈕。按一下按鈕，就把藥單裡的每種藥各記一筆。" />

      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-semibold text-fg">新增按鈕</h2>
        <div className="flex flex-col gap-x-4 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Field label="按鈕名稱" required htmlFor="mb-new-name" error={error}>
              <TextInput id="mb-new-name" value={name} maxLength={LIMITS.medButtonName} invalid={!!error}
                onChange={(e) => setName(e.target.value)} placeholder="例：早上" data-testid="med-button-new-name-input" />
            </Field>
          </div>
          <Button onClick={handleCreate} disabled={saving} className="sm:mt-7" data-testid="med-button-create-btn">
            <Plus size={18} strokeWidth={1.75} aria-hidden />新增
          </Button>
        </div>
      </Card>

      {buttons === null ? (
        <Skeleton rows={4} />
      ) : buttons.length === 0 ? (
        <Card><EmptyState title="還沒有吃藥按鈕" description="先新增一顆按鈕吧，例如「早上」。" /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* key 帶入內容，資料重新載入後表單跟著重設 */}
          {buttons.map((b) => <ButtonCard key={`${b.id}-${b.name}-${b.sort}-${JSON.stringify(b.drugs)}`} button={b} all={buttons} />)}
        </div>
      )}
    </>
  );
}
