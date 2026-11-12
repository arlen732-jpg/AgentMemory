"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDateTime, fmtShortDate } from "@/lib/dates";
import type { BpRecord } from "@/lib/types";

// 2026/11/12 - Arlen - 三線趨勢圖（D12 品牌延伸），色彩取 theme.css 的 chart-* 變數，不做偏高判讀
const SERIES = [
  { key: "systolic", name: "收縮壓", color: "var(--color-chart-systolic)" },
  { key: "diastolic", name: "舒張壓", color: "var(--color-chart-diastolic)" },
  { key: "pulse", name: "脈搏", color: "var(--color-chart-pulse)" },
] as const;

export default function BpChart({ rows }: { rows: BpRecord[] }) {
  const data = [...rows]
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    .map((r) => ({ t: r.measuredAt, systolic: r.systolic, diastolic: r.diastolic, pulse: r.pulse }));

  return (
    <div className="h-72 w-full" data-testid="bp-chart" role="img" aria-label={`血壓趨勢圖，共 ${rows.length} 筆`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" tickFormatter={fmtShortDate} tick={{ fill: "var(--color-chart-axis)", fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={["dataMin - 10", "dataMax + 10"]} tick={{ fill: "var(--color-chart-axis)", fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            labelFormatter={(v) => fmtDateTime(String(v))}
            contentStyle={{ borderRadius: 8, border: "none", boxShadow: "var(--shadow-md)", fontSize: 13 }}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
          {SERIES.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2}
              dot={{ r: 2.5 }} activeDot={{ r: 5 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
