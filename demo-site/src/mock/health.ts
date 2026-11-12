import type { BpRecord, MedRecord } from "@/lib/types";

// 2026/11/12 - Arlen - 血壓／吃藥示意資料。以「今天」往前推，固定亂數種子，每次產生結果相同

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** 台北時間：今天往前 daysAgo 天的 hh:mm */
function taipeiAt(daysAgo: number, hh: number, mm: number) {
  const now = new Date(Date.now() + 8 * 3600_000);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, hh - 8, mm));
  return d.toISOString();
}

const notPast = (iso: string) => new Date(iso).getTime() <= Date.now();

const BP_NOTES = ["", "", "", "", "", "前晚睡不好", "量前喝了咖啡", "運動後", "有點頭暈"];

export function seedBp(): BpRecord[] {
  const r = rng(20261112);
  const rows: BpRecord[] = [];
  for (let day = 59; day >= 0; day--) {
    if (r() < 0.33 && day !== 0) continue;
    const systolic = Math.round(122 + r() * 16 - day * 0.05);
    const diastolic = Math.round(76 + r() * 11);
    const at = taipeiAt(day, 7, 10 + Math.floor(r() * 40));
    if (!notPast(at)) continue;
    rows.push({
      id: `bp-${rows.length + 1}`,
      measuredAt: at,
      systolic,
      diastolic,
      pulse: r() < 0.08 ? null : Math.round(64 + r() * 12),
      note: BP_NOTES[Math.floor(r() * BP_NOTES.length)],
    });
  }
  return rows;
}

export function seedMed(): MedRecord[] {
  const r = rng(7);
  const rows: Omit<MedRecord, "id">[] = [];
  for (let day = 59; day >= 0; day--) {
    if (day <= 45 && r() > 0.06) rows.push({ takenAt: taipeiAt(day, 8, Math.floor(r() * 30)), drug: "降血壓藥", dose: "1 顆", note: "" });
    if (day % 2 === 0) rows.push({ takenAt: taipeiAt(day, 12, 45 + Math.floor(r() * 10)), drug: "維他命 D", dose: "1000 IU", note: "" });
    if (day % 7 === 3) rows.push({ takenAt: taipeiAt(day, 20, Math.floor(r() * 50)), drug: "魚油", dose: "2 顆", note: day > 30 ? "飯後" : "" });
  }
  return rows.filter((m) => notPast(m.takenAt)).map((m, i) => ({ ...m, id: `med-${i + 1}` }));
}
