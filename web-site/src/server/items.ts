// 2026/11/12 - Arlen - 分類維護：記憶的分類必須先在這裡建立；網頁 API 與 MCP 共用
// - 預設分類（MEMORY_DEFAULT_ITEM）不可改名、不可刪除
// - 改名靠外鍵 ON UPDATE CASCADE 連帶更新記憶；有記憶的分類不可刪（外鍵 RESTRICT 也會擋）
import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { memories, memoryItems } from "@/db/schema";
import type { MemoryItem } from "@/lib/types";
import { LIMITS, MEMORY_DEFAULT_ITEM } from "@/lib/validation";
import { db } from "./db";
import { ApiError, assertId, assertValid, ERROR_CODE } from "./http";

const ITEM_NOT_FOUND = "找不到這個分類，可能已被刪除。";
const VALIDATION_MSG = "有欄位未通過檢查，請依提示修正後重新送出。";

/** 分類清單：預設分類排第一，其餘依名稱；附每個分類的記憶筆數 */
export async function listItems(): Promise<MemoryItem[]> {
  const [rows, counts] = await Promise.all([
    db().select().from(memoryItems).orderBy(asc(memoryItems.name)),
    db().select({ item: memories.item, n: count() }).from(memories).groupBy(memories.item),
  ]);
  const byName = new Map(counts.map((c) => [c.item, c.n]));
  return rows
    .map((r) => ({ id: r.id, name: r.name, memoryCount: byName.get(r.name) ?? 0, createdAt: r.createdAt.toISOString() }))
    .sort((a, b) => Number(b.name === MEMORY_DEFAULT_ITEM) - Number(a.name === MEMORY_DEFAULT_ITEM));
}

export async function itemNames(): Promise<string[]> {
  return (await listItems()).map((i) => i.name);
}

/** 寫入記憶前檢查分類是否存在；不存在時錯誤訊息附上現有分類，方便 AI 自行改正 */
export async function assertItemExists(name: string) {
  const [hit] = await db().select({ id: memoryItems.id }).from(memoryItems).where(eq(memoryItems.name, name)).limit(1);
  if (hit) return;
  const names = await itemNames();
  throw new ApiError(ERROR_CODE.VALIDATION, VALIDATION_MSG, {
    item: `分類「${name}」不存在。現有分類：${names.join("、")}。要用新分類，請先到網頁「分類維護」頁新增。`,
  });
}

function cleanName(raw: unknown): string {
  const name = String(raw ?? "").trim();
  if (!name) assertValid({ name: "請輸入分類名稱" });
  if (name.length > LIMITS.itemName) assertValid({ name: `分類名稱最多 ${LIMITS.itemName} 字` });
  return name;
}

async function assertNameFree(name: string, excludeId?: string) {
  const [hit] = await db().select({ id: memoryItems.id }).from(memoryItems).where(eq(memoryItems.name, name)).limit(1);
  if (hit && hit.id !== excludeId) assertValid({ name: `分類「${name}」已存在` });
}

async function getItem(id: string) {
  assertId(id, ITEM_NOT_FOUND);
  const [row] = await db().select().from(memoryItems).where(eq(memoryItems.id, id)).limit(1);
  if (!row) throw new ApiError(ERROR_CODE.NOT_FOUND, ITEM_NOT_FOUND);
  return row;
}

async function toItem(id: string): Promise<MemoryItem> {
  const found = (await listItems()).find((i) => i.id === id);
  if (!found) throw new ApiError(ERROR_CODE.NOT_FOUND, ITEM_NOT_FOUND);
  return found;
}

export async function createItem(input: { name?: unknown }): Promise<MemoryItem> {
  const name = cleanName(input.name);
  await assertNameFree(name);
  const [row] = await db().insert(memoryItems).values({ name }).returning();
  return toItem(row.id);
}

/** 改名：記憶的分類由外鍵 ON UPDATE CASCADE 一起更新 */
export async function renameItem(id: string, input: { name?: unknown }): Promise<MemoryItem> {
  const row = await getItem(id);
  if (row.name === MEMORY_DEFAULT_ITEM) throw new ApiError(ERROR_CODE.CONFLICT, `「${MEMORY_DEFAULT_ITEM}」是預設分類，不能改名。`);
  const name = cleanName(input.name);
  if (name !== row.name) {
    await assertNameFree(name, id);
    await db().update(memoryItems).set({ name }).where(eq(memoryItems.id, id));
  }
  return toItem(id);
}

export async function deleteItem(id: string): Promise<void> {
  const row = await getItem(id);
  if (row.name === MEMORY_DEFAULT_ITEM) throw new ApiError(ERROR_CODE.CONFLICT, `「${MEMORY_DEFAULT_ITEM}」是預設分類，不能刪除。`);
  const [{ n }] = await db().select({ n: count() }).from(memories).where(eq(memories.item, row.name));
  if (n > 0) throw new ApiError(ERROR_CODE.CONFLICT, `分類「${row.name}」還有 ${n} 筆記憶，請先刪除或改到其他分類。`);
  await db().delete(memoryItems).where(eq(memoryItems.id, id));
}
