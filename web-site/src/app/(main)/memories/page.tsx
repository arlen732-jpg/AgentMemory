"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Upload } from "lucide-react";
import { Badge, Button, Card, EmptyState, LinkButton, PageHeader, Select, Skeleton, TextInput } from "@/components/ui";
import MemoryDrawer from "@/components/memories/MemoryDrawer";
import { useCollection } from "@/lib/store";
import { fmtDateTime } from "@/lib/dates";
import type { Memory } from "@/lib/types";

const ALL = "__all__";

export default function MemoriesPage() {
  const [memories] = useCollection("memories");
  const [item, setItem] = useState(ALL);
  const [tag, setTag] = useState(ALL);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Memory | "new" | null>(null);

  const items = useMemo(() => [...new Set((memories ?? []).map((m) => m.item))], [memories]);
  const tags = useMemo(() => [...new Set((memories ?? []).flatMap((m) => m.tags))].sort(), [memories]);

  // F4：搜尋名稱、摘要與內容
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return (memories ?? [])
      .filter((m) => item === ALL || m.item === item)
      .filter((m) => tag === ALL || m.tags.includes(tag))
      .filter((m) => !kw || [m.key, m.summary, m.value].some((s) => s.toLowerCase().includes(kw)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [memories, item, tag, q]);

  const filtering = item !== ALL || tag !== ALL || q.trim() !== "";

  return (
    <>
      <PageHeader
        title="記憶"
        description="AI 助手記下的事。摘要會出現在目錄上，讓 AI 判斷要不要取這一筆。"
        actions={
          <>
            <LinkButton href="/memories/import" variant="secondary" data-testid="memories-import-link">
              <Upload size={18} strokeWidth={1.75} aria-hidden />匯入
            </LinkButton>
            <Button onClick={() => setEditing("new")} data-testid="memories-add-btn">
              <Plus size={18} strokeWidth={1.75} aria-hidden />新增記憶
            </Button>
          </>
        }
      />

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} strokeWidth={1.75} aria-hidden />
            <TextInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋名稱、摘要或內容"
              aria-label="搜尋記憶"
              maxLength={50}
              className="pl-10"
              data-testid="memories-search-input"
            />
          </div>
          <Select value={item} onChange={(e) => setItem(e.target.value)} aria-label="分類" data-testid="memories-item-select">
            <option value={ALL}>全部分類</option>
            {items.map((i) => <option key={i} value={i}>{i}</option>)}
          </Select>
          <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="標籤" data-testid="memories-tag-select">
            <option value={ALL}>全部標籤</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
      </Card>

      {memories === null ? (
        <Skeleton rows={6} />
      ) : filtered.length === 0 ? (
        <Card>
          {filtering ? (
            <EmptyState title="找不到符合的記憶" description="換個關鍵字，或清除篩選條件。"
              action={<Button variant="secondary" data-testid="memories-clear-filter-btn" onClick={() => { setQ(""); setItem(ALL); setTag(ALL); }}>清除篩選</Button>} />
          ) : (
            <EmptyState title="還沒有任何記憶" description="新增第一筆，或從 memory.json 匯入。"
              action={<Button data-testid="memories-empty-add-btn" onClick={() => setEditing("new")}>新增記憶</Button>} />
          )}
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-fg-muted" data-testid="memories-count">共 {filtered.length} 筆</p>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setEditing(m)}
                  data-testid="memory-item"
                  className="flex h-full w-full flex-col rounded-md bg-surface p-5 text-left shadow-sm transition-all duration-[var(--duration-base)] hover:-translate-y-px hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-base font-semibold text-fg">{m.key}</span>
                    <Badge tone="primary">{m.item}</Badge>
                  </div>
                  <span className="mt-1 text-sm text-secondary-text">{m.summary}</span>
                  <span className="mt-3 line-clamp-3 break-all text-sm text-fg-secondary">{m.value}</span>
                  <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
                    {m.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                    <span className="ml-auto text-xs text-fg-muted">{fmtDateTime(m.updatedAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing !== null && (
        <MemoryDrawer
          key={editing === "new" ? "new" : editing.id}
          memory={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
