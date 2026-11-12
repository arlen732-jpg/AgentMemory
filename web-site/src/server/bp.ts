// 2026/11/12 - Arlen - 血壓資料存取（F7、F8、F10）；網頁 API 與 MCP 工具共用
import "server-only";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { bpRecords } from "@/db/schema";
import { validateBp } from "@/lib/validation";
import type { BpRecord } from "@/lib/types";
import { decryptNote, encryptNote } from "./crypto";
import { db } from "./db";
import { ApiError, assertId, assertValid, ERROR_CODE } from "./http";

type Row = typeof bpRecords.$inferSelect;

export const toBp = (r: Row): BpRecord => ({
  id: r.id, measuredAt: r.measuredAt.toISOString(), systolic: r.systolic, diastolic: r.diastolic, pulse: r.pulse, note: decryptNote(r.note),
});

/** 外部輸入（網頁或 MCP）；數字可為 number 或字串 */
export type BpPayload = { measuredAt?: string; systolic?: number | string; diastolic?: number | string; pulse?: number | string | null; note?: string };

const str = (v: unknown) => (v == null ? "" : String(v).trim());

/** 共用 lib/validation 的規則；通過後轉成 DB 欄位 */
function toValues(p: BpPayload) {
  const input = { measuredAt: str(p.measuredAt), systolic: str(p.systolic), diastolic: str(p.diastolic), pulse: str(p.pulse), note: str(p.note) };
  const at = new Date(input.measuredAt);
  if (input.measuredAt && Number.isNaN(at.getTime())) assertValid({ measuredAt: "量測時間格式不正確" });
  assertValid(validateBp(input));
  return {
    measuredAt: at, systolic: Number(input.systolic), diastolic: Number(input.diastolic),
    pulse: input.pulse ? Number(input.pulse) : null, note: encryptNote(input.note),
  };
}

/** 解析期間參數；不合法的時間直接拒絕 */
export function parseRange(from?: string | null, to?: string | null): { from?: Date; to?: Date } {
  const parse = (v: string | null | undefined, label: string) => {
    if (!v) return undefined;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new ApiError(ERROR_CODE.VALIDATION, `${label}格式不正確，請用 ISO-8601（例：2026-11-01T00:00:00+08:00）。`);
    return d;
  };
  return { from: parse(from, "起始時間"), to: parse(to, "結束時間") };
}

export async function listBp(range: { from?: Date; to?: Date } = {}): Promise<BpRecord[]> {
  const conds: SQL[] = [];
  if (range.from) conds.push(gte(bpRecords.measuredAt, range.from));
  if (range.to) conds.push(lte(bpRecords.measuredAt, range.to));
  const rows = await db().select().from(bpRecords).where(conds.length ? and(...conds) : undefined).orderBy(desc(bpRecords.measuredAt));
  return rows.map(toBp);
}

export async function createBp(p: BpPayload): Promise<BpRecord> {
  const [row] = await db().insert(bpRecords).values(toValues(p)).returning();
  return toBp(row);
}

const BP_NOT_FOUND = "找不到這筆血壓紀錄，可能已被刪除。";

export async function updateBp(id: string, p: BpPayload): Promise<BpRecord> {
  assertId(id, BP_NOT_FOUND); // 2026/11/12 - Arlen - 非 UUID 回 404
  const [row] = await db().update(bpRecords).set({ ...toValues(p), updatedAt: new Date() }).where(eq(bpRecords.id, id)).returning();
  if (!row) throw new ApiError(ERROR_CODE.NOT_FOUND, "找不到這筆血壓紀錄，可能已被刪除。");
  return toBp(row);
}

export async function deleteBp(id: string): Promise<void> {
  assertId(id, BP_NOT_FOUND); // 2026/11/12 - Arlen - 非 UUID 回 404
  const rows = await db().delete(bpRecords).where(eq(bpRecords.id, id)).returning({ id: bpRecords.id });
  if (!rows.length) throw new ApiError(ERROR_CODE.NOT_FOUND, "找不到這筆血壓紀錄，可能已被刪除。");
}
