"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import BpChart from "@/components/health/BpChart";
import BpDrawer from "@/components/health/BpDrawer";
import PeriodFilter, { defaultPeriod, periodQuery, type Period } from "@/components/health/PeriodFilter";
import { Button, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { bpSummary } from "@/lib/bpStats";
import { fmtDateTime } from "@/lib/dates";
import { useCollection } from "@/lib/store";
import type { BpRecord } from "@/lib/types";

export default function BpPage() {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  // 2026/11/12 - Arlen - 期間篩選改由後端處理；結果已依量測時間新到舊排序
  const query = useMemo(() => periodQuery(period), [period]);
  const [records] = useCollection("bp", query);
  const [editing, setEditing] = useState<BpRecord | "new" | null>(null);
  const rows = records ?? [];

  const s = bpSummary(rows);
  const fmt = (v: number | undefined) => (v == null ? "—" : v);

  return (
    <>
      <PageHeader
        title="血壓"
        description="只記錄與呈現數字，不做健康判讀。"
        actions={<Button onClick={() => setEditing("new")} data-testid="bp-add-btn"><Plus size={18} strokeWidth={1.75} aria-hidden />新增血壓</Button>}
      />

      <div className="mb-6"><PeriodFilter value={period} onChange={setPeriod} testId="bp" /></div>

      {records === null ? (
        <Skeleton rows={6} />
      ) : rows.length === 0 ? (
        <Card><EmptyState title="這段期間沒有血壓紀錄" description="換個期間，或新增一筆。"
          action={<Button onClick={() => setEditing("new")} data-testid="bp-empty-add-btn">新增血壓</Button>} /></Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="bp-summary">
            <Card>
              <p className="text-sm text-fg-muted">筆數</p>
              <p className="mt-1 text-3xl font-bold text-fg">{s.count}</p>
            </Card>
            {([["systolic", "收縮壓", "bg-chart-systolic"], ["diastolic", "舒張壓", "bg-chart-diastolic"], ["pulse", "脈搏", "bg-chart-pulse"]] as const).map(([k, label, dot]) => (
              <Card key={k}>
                <p className="flex items-center gap-2 text-sm text-fg-muted"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}平均</p>
                <p className="mt-1 text-3xl font-bold text-fg">{fmt(s[k]?.avg)}</p>
                <p className="mt-1 text-xs text-fg-muted">最高 {fmt(s[k]?.max)} ／ 最低 {fmt(s[k]?.min)}</p>
              </Card>
            ))}
          </div>

          <Card className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-fg">趨勢</h2>
            <BpChart rows={rows} />
          </Card>

          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-fg-muted">
                    <th className="px-5 py-3 font-medium">量測時間</th>
                    <th className="px-3 py-3 text-right font-medium">收縮壓</th>
                    <th className="px-3 py-3 text-right font-medium">舒張壓</th>
                    <th className="px-3 py-3 text-right font-medium">脈搏</th>
                    <th className="px-5 py-3 font-medium">備註</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => setEditing(r)} className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-muted" data-testid="bp-row">
                      <td className="px-5 py-3">
                        <button type="button" className="text-left text-fg hover:underline" onClick={(e) => { e.stopPropagation(); setEditing(r); }} data-testid="bp-row-edit-btn">
                          {fmtDateTime(r.measuredAt)}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-fg">{r.systolic}</td>
                      <td className="px-3 py-3 text-right font-semibold text-fg">{r.diastolic}</td>
                      <td className="px-3 py-3 text-right text-fg-secondary">{r.pulse ?? "—"}</td>
                      <td className="max-w-56 truncate px-5 py-3 text-fg-secondary">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {editing !== null && (
        <BpDrawer key={editing === "new" ? "new" : editing.id} record={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
