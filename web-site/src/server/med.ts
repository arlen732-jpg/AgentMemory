// 2026/11/12 - Arlen - 吃藥資料存取（F9、F10）；網頁 API 與 MCP 工具共用
import "server-only";
import { and, asc, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { medRecords } from "@/db/schema";
import { validateMed } from "@/lib/validation";
import type { MedRecord } from "@/lib/types";
import { decryptNote, encryptNote } from "./crypto";
import { db } from "./db";
import { ApiError, assertId, assertValid, ERROR_CODE } from "./http";

type Row = typeof medRecords.$inferSelect;

export const toMed = (r: Row): MedRecord => ({
  id: r.id, takenAt: r.takenAt.toISOString(), drug: r.drug, dose: r.dose, note: decryptNote(r.note),
});

export type MedPayload = { takenAt?: string; drug?: string; dose?: string; note?: string };

const str = (v: unknown) => (v == null ? "" : String(v).trim());

function toValues(p: MedPayload) {
  const input = { takenAt: str(p.takenAt), drug: str(p.drug), dose: str(p.dose), note: str(p.note) };
  const at = new Date(input.takenAt);
  if (input.takenAt && Number.isNaN(at.getTime())) assertValid({ takenAt: "服藥時間格式不正確" });
  assertValid(validateMed(input));
  return { takenAt: at, drug: input.drug, dose: input.dose, note: encryptNote(input.note) };
}

export type MedFilter = { from?: Date; to?: Date; drug?: string };

export async function listMed(f: MedFilter = {}): Promise<MedRecord[]> {
  const conds: SQL[] = [];
  if (f.from) conds.push(gte(medRecords.takenAt, f.from));
  if (f.to) conds.push(lte(medRecords.takenAt, f.to));
  if (f.drug?.trim()) conds.push(eq(medRecords.drug, f.drug.trim()));
  const rows = await db().select().from(medRecords).where(conds.length ? and(...conds) : undefined).orderBy(desc(medRecords.takenAt));
  return rows.map(toMed);
}

/** 曾經輸入過的藥名（藥名提示、MCP med_drugs） */
export async function listDrugs(): Promise<string[]> {
  const rows = await db().selectDistinct({ drug: medRecords.drug }).from(medRecords).orderBy(asc(medRecords.drug));
  return rows.map((r) => r.drug);
}

export async function createMed(p: MedPayload): Promise<MedRecord> {
  const [row] = await db().insert(medRecords).values(toValues(p)).returning();
  return toMed(row);
}

const MED_NOT_FOUND = "找不到這筆吃藥紀錄，可能已被刪除。";

export async function updateMed(id: string, p: MedPayload): Promise<MedRecord> {
  assertId(id, MED_NOT_FOUND); // 2026/11/12 - Arlen - 非 UUID 回 404
  const [row] = await db().update(medRecords).set({ ...toValues(p), updatedAt: new Date() }).where(eq(medRecords.id, id)).returning();
  if (!row) throw new ApiError(ERROR_CODE.NOT_FOUND, "找不到這筆吃藥紀錄，可能已被刪除。");
  return toMed(row);
}

export async function deleteMed(id: string): Promise<void> {
  assertId(id, MED_NOT_FOUND); // 2026/11/12 - Arlen - 非 UUID 回 404
  const rows = await db().delete(medRecords).where(eq(medRecords.id, id)).returning({ id: medRecords.id });
  if (!rows.length) throw new ApiError(ERROR_CODE.NOT_FOUND, "找不到這筆吃藥紀錄，可能已被刪除。");
}
