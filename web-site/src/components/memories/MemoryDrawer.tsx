"use client";

import { useState, type KeyboardEvent } from "react";
import { Trash2, X } from "lucide-react";
import Drawer from "@/components/Drawer";
import { useDialog } from "@/components/dialogs";
import { Badge, Button, Field, Select, TextArea, TextInput } from "@/components/ui";
import { ClientApiError, errorMessage } from "@/lib/api";
import { useCollection } from "@/lib/store";
import { hasErrors, LIMITS, MEMORY_DEFAULT_ITEM, validateMemory, type Errors, type MemoryInput } from "@/lib/validation";
import type { Memory } from "@/lib/types";

const empty = (): MemoryInput => ({ item: MEMORY_DEFAULT_ITEM, key: "", summary: "", value: "", tags: [] });

/**
 * 記憶新增／修改抽屜（F4）；memory 為 null 時是新增。
 * 由父層條件渲染並給 key，每次開啟都是全新元件，表單初值用 useState 初始化函式帶入。
 */
export default function MemoryDrawer({ memory, onClose }: { memory: Memory | null; onClose: () => void }) {
  const [all, api] = useCollection("memories");
  const [itemList] = useCollection("items");
  const dialog = useDialog();
  const [form, setForm] = useState<MemoryInput>(() =>
    memory ? { item: memory.item, key: memory.key, summary: memory.summary, value: memory.value, tags: [...memory.tags] } : empty());
  const [tagDraft, setTagDraft] = useState("");
  const [errors, setErrors] = useState<Errors<keyof MemoryInput>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof MemoryInput>(k: K, v: MemoryInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const addTag = () => {
    const t = tagDraft.trim();
    if (t && !form.tags.includes(t) && form.tags.length < LIMITS.tagCount) set("tags", [...form.tags, t]);
    setTagDraft("");
  };
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
  };

  const handleSave = async () => {
    const e = validateMemory(form, all ?? [], memory?.id);
    setErrors(e);
    if (hasErrors(e)) {
      await dialog.notify({ ok: false, title: "儲存失敗", message: "有欄位未通過檢查，請依紅字修正後重新儲存。" });
      return;
    }
    // DevGuidelines：字串儲存前一律 Trim（後端會再 trim 一次）
    const row = { item: form.item.trim(), key: form.key.trim(), summary: form.summary.trim(), value: form.value.trim(), tags: form.tags };
    // 2026/11/12 - Arlen - 改呼叫 API；後端的欄位錯誤直接顯示成紅字 - Start
    setSaving(true);
    try {
      if (memory) await api.update(memory.id, row);
      else await api.add(row);
    } catch (err) {
      if (err instanceof ClientApiError) setErrors(err.fields as Errors<keyof MemoryInput>);
      await dialog.notify({ ok: false, title: "儲存失敗", message: errorMessage(err) });
      return;
    } finally {
      setSaving(false);
    }
    // 2026/11/12 - Arlen - 改呼叫 API - end
    await dialog.notify({ ok: true, title: "已儲存", message: `記憶「${row.key}」已儲存，AI 助手下次查詢就會看到。` });
    onClose();
  };

  const handleDelete = async () => {
    if (!memory) return;
    if (!(await dialog.confirmDelete({ target: `記憶「${memory.key}」` }))) return;
    try {
      await api.remove(memory.id);
    } catch (err) {
      await dialog.notify({ ok: false, title: "刪除失敗", message: errorMessage(err) });
      return;
    }
    await dialog.notify({ ok: true, title: "已刪除", message: `記憶「${memory.key}」已刪除。` });
    onClose();
  };

  // 2026/11/12 - Arlen - 分類選項改取自分類維護；載入前先放目前值，避免下拉選單閃成空白
  const items = itemList ? itemList.map((i) => i.name) : [form.item];

  return (
    <Drawer
      open
      title={memory ? "修改記憶" : "新增記憶"}
      onClose={onClose}
      testId="memory-drawer"
      footer={
        <>
          {memory && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={handleDelete} data-testid="memory-delete-btn">
              <Trash2 size={18} strokeWidth={1.75} aria-hidden />刪除
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} data-testid="memory-cancel-btn">取消</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="memory-save-btn">{saving ? "儲存中…" : "儲存"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Field label="名稱" required htmlFor="memory-key" error={errors.key}>
          <TextInput id="memory-key" value={form.key} maxLength={LIMITS.memoryKey} invalid={!!errors.key}
            onChange={(e) => set("key", e.target.value)} placeholder="例：上班時間" data-testid="memory-key-input" />
        </Field>
        <Field label="摘要" required htmlFor="memory-summary" error={errors.summary}
          hint={`${form.summary.trim().length} / ${LIMITS.memorySummary}`}>
          <TextInput id="memory-summary" value={form.summary} maxLength={LIMITS.memorySummary} invalid={!!errors.summary}
            onChange={(e) => set("summary", e.target.value)} placeholder="這筆記憶回答什麼問題，例：工作時段" data-testid="memory-summary-input" />
        </Field>
        <Field label="內容" required htmlFor="memory-value" error={errors.value}>
          <TextArea id="memory-value" value={form.value} maxLength={LIMITS.memoryValue} rows={5} invalid={!!errors.value}
            onChange={(e) => set("value", e.target.value)} data-testid="memory-value-input" />
        </Field>
        <Field label="分類" required htmlFor="memory-item" error={errors.item}>
          <Select id="memory-item" value={form.item} onChange={(e) => set("item", e.target.value)} data-testid="memory-item-select">
            {items.map((i) => <option key={i} value={i}>{i}</option>)}
          </Select>
        </Field>
        <Field label="標籤" htmlFor="memory-tag" error={errors.tags} hint="按 Enter 加入">
          <div className="flex gap-2">
            <TextInput id="memory-tag" value={tagDraft} maxLength={LIMITS.tag} onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={onTagKey} placeholder="例：作息" data-testid="memory-tag-input" />
            <Button variant="secondary" onClick={addTag} data-testid="memory-tag-add-btn">加入</Button>
          </div>
        </Field>
        {form.tags.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-2">
            {form.tags.map((t) => (
              <button key={t} type="button" onClick={() => set("tags", form.tags.filter((x) => x !== t))}
                aria-label={`移除標籤 ${t}`} data-testid="memory-tag-remove-btn">
                <Badge tone="primary">{t}<X size={12} className="ml-1" aria-hidden /></Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
