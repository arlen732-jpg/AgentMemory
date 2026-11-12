"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { Download, FileJson } from "lucide-react";
import { useDialog } from "@/components/dialogs";
import { Badge, Button, Card, LinkButton, PageHeader, TextInput } from "@/components/ui";
import { newId, useCollection } from "@/lib/store";
import { fmtDateTime } from "@/lib/dates";
import { LIMITS, RESERVED_KEY } from "@/lib/validation";
import { MEMORY_DEFAULT_ITEM } from "@/mock/memories";

// 2026/11/12 - Arlen - F6 匯入既有 memory.json
type RawRow = { key: string; value: string; tags: string[]; updatedAt: string };
type PreviewRow = RawRow & { summary: string; existingId: string | null; action: "overwrite" | "skip" };

const MAX_FILE_BYTES = 1024 * 1024;

/** 格式檢查：任一筆不符就整份不匯入，並指出第幾筆 */
function parseMemoryJson(text: string): { rows?: RawRow[]; error?: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "檔案不是有效的 JSON。" };
  }
  if (!Array.isArray(data)) return { error: "最外層必須是陣列（與 memory.json 相同）。" };
  const rows: RawRow[] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i] as Partial<RawRow>;
    const n = i + 1;
    if (typeof r?.key !== "string" || !r.key.trim()) return { error: `第 ${n} 筆缺少 key（名稱）。` };
    if (r.key.trim().length > LIMITS.memoryKey) return { error: `第 ${n} 筆名稱超過 ${LIMITS.memoryKey} 字。` };
    if (r.key.trim().toLowerCase() === RESERVED_KEY) return { error: `第 ${n} 筆名稱是保留字 index。` };
    if (typeof r.value !== "string" || !r.value.trim()) return { error: `第 ${n} 筆缺少 value（內容）。` };
    if (!Array.isArray(r.tags) || r.tags.some((t) => typeof t !== "string")) return { error: `第 ${n} 筆 tags 必須是文字陣列。` };
    if (typeof r.updatedAt !== "string" || Number.isNaN(new Date(r.updatedAt).getTime())) return { error: `第 ${n} 筆 updatedAt 不是有效時間。` };
    if (rows.some((x) => x.key === r.key!.trim())) return { error: `第 ${n} 筆名稱「${r.key}」在檔案中重複。` };
    rows.push({ key: r.key.trim(), value: r.value.trim(), tags: r.tags.map((t) => t.trim()).filter(Boolean), updatedAt: r.updatedAt });
  }
  if (rows.length === 0) return { error: "檔案中沒有任何記憶。" };
  return { rows };
}

export default function ImportPage() {
  const router = useRouter();
  const dialog = useDialog();
  const [memories, api] = useCollection("memories");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    // 檔案上傳：副檔名白名單＋大小上限
    if (!f.name.toLowerCase().endsWith(".json") || (f.type && f.type !== "application/json")) {
      await dialog.notify({ ok: false, title: "檔案格式錯誤", message: "只接受 .json 檔，請重新選擇。" });
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      await dialog.notify({ ok: false, title: "檔案太大", message: "檔案上限 1 MB。" });
      return;
    }
    const { rows, error } = parseMemoryJson(await f.text());
    if (error || !rows) {
      setPreview(null);
      await dialog.notify({ ok: false, title: "整份不匯入", message: `${error}\n請修正檔案後重新選擇。` });
      return;
    }
    setFileName(f.name);
    setPreview(rows.map((r) => {
      const hit = (memories ?? []).find((m) => m.item === MEMORY_DEFAULT_ITEM && m.key === r.key);
      return { ...r, summary: r.value.slice(0, LIMITS.memorySummary), existingId: hit?.id ?? null, action: hit ? "skip" : "overwrite" };
    }));
  };

  const setRow = (i: number, patch: Partial<PreviewRow>) =>
    setPreview((p) => p && p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const summaryError = (s: string) => {
    const t = s.trim();
    if (!t) return "請填摘要";
    if (t.length < LIMITS.memorySummaryMin) return `至少 ${LIMITS.memorySummaryMin} 字`;
    return "";
  };

  const handleImport = async () => {
    if (!preview || !memories) return;
    const targets = preview.filter((r) => !(r.existingId && r.action === "skip"));
    const bad = targets.findIndex((r) => summaryError(r.summary));
    if (bad >= 0) {
      await dialog.notify({ ok: false, title: "匯入失敗", message: `「${targets[bad].key}」的摘要未通過檢查，請修正後再匯入。` });
      return;
    }
    let next = [...memories];
    for (const r of targets) {
      const row = { item: MEMORY_DEFAULT_ITEM, key: r.key, summary: r.summary.trim(), value: r.value, tags: r.tags, updatedAt: r.updatedAt };
      next = r.existingId ? next.map((m) => (m.id === r.existingId ? { ...m, ...row } : m)) : [...next, { ...row, id: newId() }];
    }
    api.replaceAll(next);
    const skipped = preview.length - targets.length;
    await dialog.notify({ ok: true, title: "匯入完成", message: `已匯入 ${targets.length} 筆，略過 ${skipped} 筆。` });
    router.push("/memories");
  };

  const conflicts = preview?.filter((r) => r.existingId).length ?? 0;

  return (
    <>
      <PageHeader
        title="匯入 memory.json"
        description="把本機的記憶搬到雲端。匯入的分類一律為「個人」，保留檔案裡原本的更新時間。"
      />

      <Card className="mb-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <FileJson className="text-primary" size={40} strokeWidth={1.75} aria-hidden />
          <div className="flex-1">
            <p className="font-semibold text-fg">{fileName || "選擇 memory.json 檔案"}</p>
            <p className="text-sm text-fg-secondary">格式：陣列，每筆含 key、value、tags、updatedAt。上限 1 MB。</p>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} data-testid="import-file-input" />
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/samples/memory-sample.json" download variant="ghost" data-testid="import-sample-link">
              <Download size={18} strokeWidth={1.75} aria-hidden />範例檔
            </LinkButton>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} data-testid="import-choose-btn">選擇檔案</Button>
          </div>
        </div>
      </Card>

      {preview && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-fg">預覽（{preview.length} 筆）</h2>
            {conflicts > 0 && <Badge tone="warning">{conflicts} 筆名稱重複，請選擇覆蓋或略過</Badge>}
          </div>
          <p className="mb-4 text-sm text-fg-secondary">memory.json 沒有摘要，已先帶入內容前 {LIMITS.memorySummary} 字，請改成一句話說明這筆記憶回答什麼問題。</p>

          <ul className="flex flex-col gap-3">
            {preview.map((r, i) => {
              const err = !(r.existingId && r.action === "skip") ? summaryError(r.summary) : "";
              return (
                <li key={r.key} className={`rounded-sm border p-4 ${r.existingId ? "border-warning/40 bg-warning-subtle/40" : "border-neutral-200"}`} data-testid="import-row">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-fg">{r.key}</span>
                    {r.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                    <span className="ml-auto text-xs text-fg-muted">{fmtDateTime(r.updatedAt)}</span>
                  </div>
                  <p className="mt-1 break-all text-sm text-fg-secondary">{r.value}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div>
                      <TextInput
                        value={r.summary}
                        maxLength={LIMITS.memorySummary}
                        onChange={(e) => setRow(i, { summary: e.target.value })}
                        aria-label={`「${r.key}」的摘要`}
                        invalid={!!err}
                        disabled={!!r.existingId && r.action === "skip"}
                        data-testid="import-summary-input"
                      />
                      <p className="mt-1 text-xs text-danger" role={err ? "alert" : undefined}>{err}</p>
                    </div>
                    {r.existingId && (
                      <fieldset className="flex gap-4 text-sm" data-testid="import-conflict-group">
                        <legend className="sr-only">「{r.key}」已存在</legend>
                        {(["overwrite", "skip"] as const).map((a) => (
                          <label key={a} className="flex min-h-11 items-center gap-2">
                            <input type="radio" name={`act-${i}`} checked={r.action === a} onChange={() => setRow(i, { action: a })}
                              className="accent-primary" data-testid={`import-${a}-radio`} />
                            {a === "overwrite" ? "覆蓋" : "略過"}
                          </label>
                        ))}
                      </fieldset>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex justify-end gap-2">
            <LinkButton href="/memories" variant="secondary" data-testid="import-cancel-btn">取消</LinkButton>
            <Button onClick={handleImport} disabled={!memories} data-testid="import-confirm-btn">確認匯入</Button>
          </div>
        </Card>
      )}
    </>
  );
}
