// 2026/11/12 - Arlen - FSD §4.4：期間內各自加總 ÷ 筆數，四捨五入到整數；脈搏只計有填的筆數

import type { BpRecord } from "./types";

type Stat = { avg: number; max: number; min: number } | null;

function stat(values: number[]): Stat {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return { avg: Math.round(sum / values.length), max: Math.max(...values), min: Math.min(...values) };
}

export function bpSummary(rows: BpRecord[]) {
  return {
    count: rows.length,
    systolic: stat(rows.map((r) => r.systolic)),
    diastolic: stat(rows.map((r) => r.diastolic)),
    pulse: stat(rows.flatMap((r) => (r.pulse == null ? [] : [r.pulse]))),
  };
}
