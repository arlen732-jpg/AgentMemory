// 2026/11/12 - Arlen - 表單驗證規則（FSD F4、F6、F7、F9、F2）
// 欄位長度：FSD 未定 DB 長度，Demo 暫定下列上限；GenTSD 定 schema 時須回頭對齊

import type { Memory } from "./types";

export const LIMITS = {
  memoryKey: 50,
  memorySummary: 30,
  memorySummaryMin: 2,
  memoryValue: 2000,
  tag: 20,
  tagCount: 10,
  note: 500,
  drug: 50,
  dose: 30,
  tokenName: 30,
} as const;

export const RESERVED_KEY = "index";

export type Errors<T extends string> = Partial<Record<T, string>>;

export type MemoryInput = { item: string; key: string; summary: string; value: string; tags: string[] };

/** 同分類內名稱唯一；excludeId 為編輯中的那一筆 */
export function validateMemory(m: MemoryInput, all: Memory[], excludeId?: string): Errors<keyof MemoryInput> {
  const e: Errors<keyof MemoryInput> = {};
  const key = m.key.trim();
  const summary = m.summary.trim();

  if (!key) e.key = "請輸入名稱";
  else if (key.length > LIMITS.memoryKey) e.key = `名稱最多 ${LIMITS.memoryKey} 字`;
  else if (key.toLowerCase() === RESERVED_KEY) e.key = "「index」是系統目錄專用，請換一個名稱";
  else if (all.some((x) => x.id !== excludeId && x.item === m.item.trim() && x.key === key)) e.key = `分類「${m.item}」已有同名記憶`;

  if (!summary) e.summary = "請輸入摘要";
  else if (summary.length < LIMITS.memorySummaryMin) e.summary = `摘要至少 ${LIMITS.memorySummaryMin} 字`;
  else if (summary.length > LIMITS.memorySummary) e.summary = `摘要最多 ${LIMITS.memorySummary} 字`;

  if (!m.value.trim()) e.value = "請輸入內容";
  else if (m.value.trim().length > LIMITS.memoryValue) e.value = `內容最多 ${LIMITS.memoryValue} 字`;

  if (!m.item.trim()) e.item = "請選擇分類";
  if (m.tags.length > LIMITS.tagCount) e.tags = `標籤最多 ${LIMITS.tagCount} 個`;
  return e;
}

// 2026/11/12 - Arlen - F7 血壓範圍
export const BP_RANGE = { systolic: [50, 300], diastolic: [30, 200], pulse: [30, 250] } as const;

export type BpInput = { measuredAt: string; systolic: string; diastolic: string; pulse: string; note: string };

function intIn(v: string, [min, max]: readonly [number, number], label: string): string | undefined {
  if (!/^\d+$/.test(v.trim())) return `${label}請輸入整數`;
  const n = Number(v);
  if (n < min || n > max) return `${label}須介於 ${min}~${max}`;
}

export function validateBp(b: BpInput): Errors<keyof BpInput> {
  const e: Errors<keyof BpInput> = {};
  if (!b.measuredAt) e.measuredAt = "請輸入量測時間";
  else if (new Date(b.measuredAt).getTime() > Date.now()) e.measuredAt = "量測時間不可晚於現在";

  if (!b.systolic.trim()) e.systolic = "請輸入收縮壓";
  else e.systolic = intIn(b.systolic, BP_RANGE.systolic, "收縮壓");
  if (!b.diastolic.trim()) e.diastolic = "請輸入舒張壓";
  else e.diastolic = intIn(b.diastolic, BP_RANGE.diastolic, "舒張壓");
  if (!e.systolic && !e.diastolic && Number(b.systolic) <= Number(b.diastolic)) e.systolic = "收縮壓必須大於舒張壓";
  if (b.pulse.trim()) e.pulse = intIn(b.pulse, BP_RANGE.pulse, "脈搏");
  if (b.note.length > LIMITS.note) e.note = `備註最多 ${LIMITS.note} 字`;
  return clean(e);
}

export type MedInput = { takenAt: string; drug: string; dose: string; note: string };

export function validateMed(m: MedInput): Errors<keyof MedInput> {
  const e: Errors<keyof MedInput> = {};
  if (!m.takenAt) e.takenAt = "請輸入服藥時間";
  else if (new Date(m.takenAt).getTime() > Date.now()) e.takenAt = "服藥時間不可晚於現在";
  if (!m.drug.trim()) e.drug = "請輸入藥名";
  if (!m.dose.trim()) e.dose = "請輸入劑量";
  if (m.note.length > LIMITS.note) e.note = `備註最多 ${LIMITS.note} 字`;
  return e;
}

/** 移除值為 undefined 的鍵，讓 hasErrors 判斷正確 */
function clean<T extends object>(e: T): T {
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as T;
}

export const hasErrors =(e: object) => Object.keys(e).length > 0;
