"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import MedDrawer from "@/components/health/MedDrawer";
import PeriodFilter, { defaultPeriod, periodRange, type Period } from "@/components/health/PeriodFilter";
import { Badge, Button, Card, EmptyState, PageHeader, Select, Skeleton } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { useCollection } from "@/lib/store";
import type { MedRecord } from "@/lib/types";

const ALL = "__all__";

export default function MedPage() {
  const [records] = useCollection("med");
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [drug, setDrug] = useState(ALL);
  const [editing, setEditing] = useState<MedRecord | "new" | null>(null);

  const drugs = useMemo(() => [...new Set((records ?? []).map((m) => m.drug))].sort(), [records]);

  const rows = useMemo(() => {
    const [from, to] = periodRange(period);
    return (records ?? [])
      .filter((r) => r.takenAt >= from && r.takenAt <= to)
      .filter((r) => drug === ALL || r.drug === drug)
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  }, [records, period, drug]);

  // 依台北日期分組，手機上比表格好讀
  const groups = useMemo(() => {
    const m = new Map<string, MedRecord[]>();
    rows.forEach((r) => {
      const d = fmtDate(r.takenAt);
      m.set(d, [...(m.get(d) ?? []), r]);
    });
    return [...m.entries()];
  }, [rows]);

  const filtering = drug !== ALL;

  return (
    <>
      <PageHeader
        title="吃藥"
        description="記錄每次服藥的時間、藥名與劑量。"
        actions={<Button onClick={() => setEditing("new")} data-testid="med-add-btn"><Plus size={18} strokeWidth={1.75} aria-hidden />新增紀錄</Button>}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <PeriodFilter value={period} onChange={setPeriod} testId="med" />
        <Select value={drug} onChange={(e) => setDrug(e.target.value)} aria-label="藥名" className="w-44" data-testid="med-drug-select">
          <option value={ALL}>全部藥名</option>
          {drugs.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
      </div>

      {records === null ? (
        <Skeleton rows={6} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title={filtering ? "找不到符合的吃藥紀錄" : "這段期間沒有吃藥紀錄"} description="換個期間或藥名，或新增一筆。"
            action={<Button onClick={() => setEditing("new")} data-testid="med-empty-add-btn">新增紀錄</Button>} />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-fg-muted" data-testid="med-count">共 {rows.length} 筆</p>
          <div className="flex flex-col gap-4">
            {groups.map(([day, items]) => (
              <Card key={day} className="p-0">
                <h2 className="border-b border-neutral-100 px-5 py-3 text-sm font-semibold text-fg-secondary">{day}</h2>
                <ul>
                  {items.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => setEditing(r)} data-testid="med-row"
                        className="flex min-h-14 w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left transition-colors hover:bg-muted">
                        <span className="w-12 text-sm text-fg-muted">{fmtDateTime(r.takenAt).slice(11)}</span>
                        <span className="font-semibold text-fg">{r.drug}</span>
                        <Badge tone="primary">{r.dose}</Badge>
                        {r.note && <span className="truncate text-sm text-fg-secondary">{r.note}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </>
      )}

      {editing !== null && (
        <MedDrawer key={editing === "new" ? "new" : editing.id} record={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
