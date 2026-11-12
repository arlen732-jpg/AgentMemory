// 2026/11/12 - Arlen - 吃藥按鈕設定：首頁依此產生一鍵記錄按鈕
// - 按鈕名稱唯一；藥單隨按鈕整批儲存（先刪後寫）
// - 按下按鈕：按鈕內每種藥各寫一筆 med_records，備註帶按鈕名稱
import "server-only";
import { asc, eq } from "drizzle-orm";
import { medButtonItems, medButtons, medRecords } from "@/db/schema";
import type { MedButton, MedButtonDrug } from "@/lib/types";
import { LIMITS } from "@/lib/validation";
import { encryptNote } from "./crypto";
import { db } from "./db";
import { ApiError, assertId, assertValid, ERROR_CODE } from "./http";

const NOT_FOUND = "找不到這顆吃藥按鈕，可能已被刪除。";

export type MedButtonPayload = { name?: unknown; sort?: unknown; drugs?: unknown };

export async function listMedButtons(): Promise<MedButton[]> {
  const [buttons, items] = await Promise.all([
    db().select().from(medButtons).orderBy(asc(medButtons.sort), asc(medButtons.createdAt)),
    db().select().from(medButtonItems).orderBy(asc(medButtonItems.sort)),
  ]);
  return buttons.map((b) => ({
    id: b.id,
    name: b.name,
    sort: b.sort,
    drugs: items.filter((i) => i.buttonId === b.id).map((i) => ({ drug: i.drug, dose: i.dose })),
    createdAt: b.createdAt.toISOString(),
  }));
}

async function toButton(id: string): Promise<MedButton> {
  const found = (await listMedButtons()).find((b) => b.id === id);
  if (!found) throw new ApiError(ERROR_CODE.NOT_FOUND, NOT_FOUND);
  return found;
}

async function getButton(id: string) {
  assertId(id, NOT_FOUND);
  const [row] = await db().select().from(medButtons).where(eq(medButtons.id, id)).limit(1);
  if (!row) throw new ApiError(ERROR_CODE.NOT_FOUND, NOT_FOUND);
  return row;
}

/** 檢查並整理輸入；藥單每列都要有藥名與劑量 */
function clean(p: MedButtonPayload) {
  const name = String(p.name ?? "").trim();
  const sortNum = p.sort == null || p.sort === "" ? 0 : Number(p.sort);
  const raw = Array.isArray(p.drugs) ? p.drugs : [];
  const drugs: MedButtonDrug[] = raw.map((d) => ({
    drug: String((d as MedButtonDrug)?.drug ?? "").trim(),
    dose: String((d as MedButtonDrug)?.dose ?? "").trim(),
  }));
  const bad = drugs.findIndex((d) => !d.drug || !d.dose || d.drug.length > LIMITS.drug || d.dose.length > LIMITS.dose);
  assertValid({
    name: !name ? "請輸入按鈕名稱" : name.length > LIMITS.medButtonName ? `按鈕名稱最多 ${LIMITS.medButtonName} 字` : undefined,
    sort: !Number.isInteger(sortNum) || sortNum < 0 || sortNum > 999 ? "順序請填 0～999 的整數" : undefined,
    drugs: p.drugs != null && !Array.isArray(p.drugs) ? "藥單格式不正確"
      : drugs.length > LIMITS.medButtonDrugs ? `每顆按鈕最多 ${LIMITS.medButtonDrugs} 種藥`
      : bad >= 0 ? `第 ${bad + 1} 種藥的藥名（${LIMITS.drug} 字內）與劑量（${LIMITS.dose} 字內）都要填` : undefined,
  });
  return { name, sort: sortNum, drugs };
}

async function assertNameFree(name: string, excludeId?: string) {
  const [hit] = await db().select({ id: medButtons.id }).from(medButtons).where(eq(medButtons.name, name)).limit(1);
  if (hit && hit.id !== excludeId) assertValid({ name: `按鈕「${name}」已存在` });
}

async function writeDrugs(buttonId: string, drugs: MedButtonDrug[]) {
  await db().delete(medButtonItems).where(eq(medButtonItems.buttonId, buttonId));
  if (drugs.length) await db().insert(medButtonItems).values(drugs.map((d, i) => ({ buttonId, ...d, sort: i })));
}

export async function createMedButton(p: MedButtonPayload): Promise<MedButton> {
  const v = clean(p);
  await assertNameFree(v.name);
  const [row] = await db().insert(medButtons).values({ name: v.name, sort: v.sort }).returning();
  await writeDrugs(row.id, v.drugs);
  return toButton(row.id);
}

export async function updateMedButton(id: string, p: MedButtonPayload): Promise<MedButton> {
  await getButton(id);
  const v = clean(p);
  await assertNameFree(v.name, id);
  await db().update(medButtons).set({ name: v.name, sort: v.sort }).where(eq(medButtons.id, id));
  await writeDrugs(id, v.drugs);
  return toButton(id);
}

export async function deleteMedButton(id: string): Promise<void> {
  await getButton(id);
  await db().delete(medButtons).where(eq(medButtons.id, id));
}

/** 按下按鈕：時間取現在，每種藥各寫一筆；回傳寫入筆數 */
export async function takeMedButton(id: string): Promise<{ count: number; takenAt: string }> {
  const b = await toButton(id);
  if (!b.drugs.length) throw new ApiError(ERROR_CODE.CONFLICT, `按鈕「${b.name}」還沒有設定藥單，請先到「吃藥按鈕設定」新增。`);
  const takenAt = new Date();
  await db().insert(medRecords).values(b.drugs.map((d) => ({ takenAt, drug: d.drug, dose: d.dose, note: encryptNote(b.name) })));
  return { count: b.drugs.length, takenAt: takenAt.toISOString() };
}
