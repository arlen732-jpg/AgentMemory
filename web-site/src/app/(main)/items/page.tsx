"use client";

// 2026/11/12 - Arlen - 分類維護：記憶（網頁與 MCP）只能使用這裡建立的分類
import { useState } from "react";
import { FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useDialog } from "@/components/dialogs";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Skeleton, TextInput } from "@/components/ui";
import { ClientApiError, errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/dates";
import { useCollection } from "@/lib/store";
import type { MemoryItem } from "@/lib/types";
import { LIMITS, MEMORY_DEFAULT_ITEM } from "@/lib/validation";

export default function ItemsPage() {
  const [items, api] = useCollection("items");
  const dialog = useDialog();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [editing, setEditing] = useState<{ id: string; name: string; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  /** 前端先擋空白、過長、重名；後端會再檢查一次 */
  const check = (n: string, excludeId?: string) => {
    if (!n) return "請輸入分類名稱";
    if (n.length > LIMITS.itemName) return `分類名稱最多 ${LIMITS.itemName} 字`;
    if ((items ?? []).some((i) => i.id !== excludeId && i.name === n)) return `分類「${n}」已存在`;
    return undefined;
  };

  const handleCreate = async () => {
    const n = name.trim();
    const e = check(n);
    setError(e);
    if (e) {
      await dialog.notify({ ok: false, title: "新增失敗", message: "有欄位未通過檢查，請依紅字修正後重新送出。" });
      return;
    }
    setSaving(true);
    try {
      await api.add({ name: n });
    } catch (err) {
      if (err instanceof ClientApiError) setError(err.fields?.name);
      await dialog.notify({ ok: false, title: "新增失敗", message: errorMessage(err) });
      return;
    } finally {
      setSaving(false);
    }
    setName("");
    await dialog.notify({ ok: true, title: "已新增", message: `分類「${n}」已新增，記憶與 AI 助手都可以使用。` });
  };

  const handleRename = async () => {
    if (!editing) return;
    const n = editing.name.trim();
    const e = check(n, editing.id);
    if (e) {
      setEditing({ ...editing, error: e });
      await dialog.notify({ ok: false, title: "改名失敗", message: "有欄位未通過檢查，請依紅字修正後重新送出。" });
      return;
    }
    setSaving(true);
    try {
      await api.update(editing.id, { name: n });
    } catch (err) {
      setEditing({ ...editing, error: err instanceof ClientApiError ? err.fields?.name : undefined });
      await dialog.notify({ ok: false, title: "改名失敗", message: errorMessage(err) });
      return;
    } finally {
      setSaving(false);
    }
    setEditing(null);
    await dialog.notify({ ok: true, title: "已改名", message: `分類已改名為「${n}」，原分類下的記憶已一併更新。` });
  };

  const handleDelete = async (it: MemoryItem) => {
    if (!(await dialog.confirmDelete({ target: `分類「${it.name}」` }))) return;
    try {
      await api.remove(it.id);
    } catch (err) {
      await dialog.notify({ ok: false, title: "刪除失敗", message: errorMessage(err) });
      return;
    }
    await dialog.notify({ ok: true, title: "已刪除", message: `分類「${it.name}」已刪除。` });
  };

  return (
    <>
      <PageHeader title="分類維護" description="記憶的分類要先在這裡建立。新增記憶時（包含 AI 助手透過 MCP 寫入）只能選這裡的分類。" />

      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-semibold text-fg">新增分類</h2>
        <div className="flex flex-col gap-x-4 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Field label="名稱" required htmlFor="item-name" error={error}>
              <TextInput id="item-name" value={name} maxLength={LIMITS.itemName} invalid={!!error}
                onChange={(e) => setName(e.target.value)} placeholder="例：工作" data-testid="item-name-input" />
            </Field>
          </div>
          <Button onClick={handleCreate} disabled={saving} className="sm:mt-7" data-testid="item-create-btn">
            <FolderPlus size={18} strokeWidth={1.75} aria-hidden />新增
          </Button>
        </div>
      </Card>

      {items === null ? (
        <Skeleton rows={4} />
      ) : items.length === 0 ? (
        <Card><EmptyState title="還沒有分類" description="先新增一個分類吧。" /></Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-fg-muted">
                  <th className="px-5 py-3 font-medium">名稱</th>
                  <th className="px-3 py-3 font-medium">記憶筆數</th>
                  <th className="px-3 py-3 font-medium">建立日期</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const isDefault = it.name === MEMORY_DEFAULT_ITEM;
                  const isEditing = editing?.id === it.id;
                  return (
                    <tr key={it.id} className="border-b border-neutral-100 last:border-0" data-testid="item-row">
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <div>
                            <TextInput value={editing.name} maxLength={LIMITS.itemName} invalid={!!editing.error} autoFocus
                              aria-label="新名稱" onChange={(e) => setEditing({ ...editing, name: e.target.value })} data-testid="item-rename-input" />
                            {editing.error && <p className="mt-1 text-xs text-danger">{editing.error}</p>}
                          </div>
                        ) : (
                          <>
                            <span className="font-semibold text-fg">{it.name}</span>
                            {isDefault && <span className="ml-2"><Badge tone="neutral">預設</Badge></span>}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3 text-fg-secondary">{it.memoryCount}</td>
                      <td className="px-3 py-3 text-fg-secondary">{fmtDate(it.createdAt)}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {isEditing ? (
                          <>
                            <Button variant="ghost" onClick={() => setEditing(null)} data-testid="item-rename-cancel-btn">取消</Button>
                            <Button onClick={handleRename} disabled={saving} data-testid="item-rename-save-btn">儲存</Button>
                          </>
                        ) : !isDefault && (
                          <>
                            <Button variant="ghost" onClick={() => setEditing({ id: it.id, name: it.name })} data-testid="item-rename-btn">
                              <Pencil size={16} strokeWidth={1.75} aria-hidden />改名
                            </Button>
                            {/* 有記憶的分類不可刪，按鈕直接停用並說明原因 */}
                            <Button variant="ghost" className="text-danger" disabled={it.memoryCount > 0}
                              title={it.memoryCount > 0 ? "還有記憶，不能刪除" : undefined}
                              onClick={() => handleDelete(it)} data-testid="item-delete-btn">
                              <Trash2 size={16} strokeWidth={1.75} aria-hidden />刪除
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
