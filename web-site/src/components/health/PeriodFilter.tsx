"use client";

import { useState } from "react";
import { endOfTaipeiDay, startOfTaipeiDaysAgo, toDateInput } from "@/lib/dates";
import { TextInput } from "@/components/ui";

export type Period = { preset: "7" | "30" | "90" | "custom"; from: string; to: string };

export const defaultPeriod = (): Period => ({ preset: "30", from: "", to: "" });

// 2026/11/12 - Arlen - 期間 → API 查詢字串；預設期間只帶 from，避免每次重算 to 造成重複查詢
export function periodQuery(p: Period): string {
  const q = new URLSearchParams();
  if (p.preset !== "custom") q.set("from", startOfTaipeiDaysAgo(Number(p.preset)));
  else {
    if (p.from) q.set("from", new Date(`${p.from}T00:00:00+08:00`).toISOString());
    if (p.to) q.set("to", endOfTaipeiDay(p.to));
  }
  return q.toString();
}

const PRESETS = [
  { v: "7", label: "7 天" },
  { v: "30", label: "30 天" },
  { v: "90", label: "90 天" },
  { v: "custom", label: "自訂" },
] as const;

export default function PeriodFilter({ value, onChange, testId }: { value: Period; onChange: (p: Period) => void; testId: string }) {
  const [today] = useState(() => toDateInput(Date.now()));
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="radiogroup" aria-label="期間" className="inline-flex rounded-sm bg-muted p-1">
        {PRESETS.map((p) => (
          <button
            key={p.v}
            type="button"
            role="radio"
            aria-checked={value.preset === p.v}
            onClick={() => onChange({ ...value, preset: p.v })}
            data-testid={`${testId}-period-${p.v}`}
            className={`min-h-9 rounded-sm px-3 text-sm transition-colors ${
              value.preset === p.v ? "bg-surface font-semibold text-primary-text shadow-sm" : "text-fg-secondary hover:text-fg"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value.preset === "custom" && (
        <div className="flex items-center gap-2">
          <TextInput type="date" value={value.from} max={value.to || today} aria-label="起日" className="w-40"
            onChange={(e) => onChange({ ...value, from: e.target.value })} data-testid={`${testId}-from-input`} />
          <span className="text-fg-muted">~</span>
          <TextInput type="date" value={value.to} min={value.from} max={today} aria-label="迄日" className="w-40"
            onChange={(e) => onChange({ ...value, to: e.target.value })} data-testid={`${testId}-to-input`} />
        </div>
      )}
    </div>
  );
}
