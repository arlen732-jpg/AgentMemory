// 2026/11/12 - Arlen - 記憶資料存取（F4、F5、F6、F11）；網頁 API 與 MCP 工具共用
import "server-only";
import { and, asc, desc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { memories } from "@/db/schema";
import { LIMITS, MEMORY_DEFAULT_ITEM, validateMemory, type MemoryInput } from "@/lib/validation";
import type { Memory } from "@/lib/types";
import { db } from "./db";
import { ApiError, assertId, assertValid, ERROR_CODE } from "./http";

type Row = typeof memories.$inferSelect;

export const toMemory = (r: Row): Memory => ({
  id: r.id, item: r.item, key: r.key, summary: r.summary, value: r.value, tags: r.tags, updatedAt: r.updatedAt.toISOString(),
});

/** 字串一律 trim；標籤去空白、去重複 */
export function cleanMemoryInput(m: Partial<MemoryInput>): MemoryInput {
  const tags = Array.isArray(m.tags) ? m.tags.map((t) => String(t).trim()).filter(Boolean) : [];
  return {
    item: String(m.item ?? "").trim() || MEMORY_DEFAULT_ITEM,
    key: String(m.key ?? "").trim(),
    summary: String(m.summary ?? "").trim(),
    value: String(m.value ?? "").trim(),
    tags: [...new Set(tags)],
  };
}

/** 欄位規則與前端同一份（lib/validation）；另檢查每個標籤長度 */
function validate(m: MemoryInput) {
  const e: Record<string, string | undefined> = validateMemory(m, []);
  if (m.tags.some((t) => t.length > LIMITS.tag)) e.tags = `每個標籤最多 ${LIMITS.tag} 字`;
  assertValid(e);
}

async function assertKeyFree(item: string, key: string, excludeId?: string) {
  const conds: SQL[] = [eq(memories.item, item), eq(memories.key, key)];
  if (excludeId) conds.push(ne(memories.id, excludeId));
  const [hit] = await db().select({ id: memories.id }).from(memories).where(and(...conds)).limit(1);
  if (hit) throw new ApiError(ERROR_CODE.VALIDATION, "有欄位未通過檢查，請依提示修正後重新送出。", { key: `分類「${item}」已有同名記憶` });
}

export type MemoryFilter = { item?: string; tag?: string; q?: string };

export async function listMemories(f: MemoryFilter = {}): Promise<Memory[]> {
  const conds: SQL[] = [];
  if (f.item) conds.push(eq(memories.item, f.item));
  if (f.tag) conds.push(sql`${f.tag} = any(${memories.tags})`);
  const kw = f.q?.trim();
  if (kw) {
    const p = `%${kw.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conds.push(or(ilike(memories.key, p), ilike(memories.summary, p), ilike(memories.value, p))!);
  }
  const rows = await db().select().from(memories).where(conds.length ? and(...conds) : undefined).orderBy(desc(memories.updatedAt));
  return rows.map(toMemory);
}

export async function createMemory(input: Partial<MemoryInput>): Promise<Memory> {
  const m = cleanMemoryInput(input);
  validate(m);
  await assertKeyFree(m.item, m.key);
  const [row] = await db().insert(memories).values(m).returning();
  return toMemory(row);
}

const MEMORY_NOT_FOUND = "找不到這筆記憶，可能已被刪除。";

export async function updateMemory(id: string, input: Partial<MemoryInput>): Promise<Memory> {
  assertId(id, MEMORY_NOT_FOUND); // 2026/11/12 - Arlen - 非 UUID 回 404
  const m = cleanMemoryInput(input);
  validate(m);
  await assertKeyFree(m.item, m.key, id);
  const [row] = await db().update(memories).set({ ...m, updatedAt: new Date() }).where(eq(memories.id, id)).returning();
  if (!row) throw new ApiError(ERROR_CODE.NOT_FOUND, "找不到這筆記憶，可能已被刪除。");
  return toMemory(row);
}

export async function deleteMemory(id: string): Promise<void> {
  assertId(id, MEMORY_NOT_FOUND); // 2026/11/12 - Arlen - 非 UUID 回 404
  const rows = await db().delete(memories).where(eq(memories.id, id)).returning({ id: memories.id });
  if (!rows.length) throw new ApiError(ERROR_CODE.NOT_FOUND, "找不到這筆記憶，可能已被刪除。");
}

// ---- MCP 用（以分類 + 名稱定位）----

export async function getMemoryByKey(item: string, key: string): Promise<Memory | null> {
  const [row] = await db().select().from(memories).where(and(eq(memories.item, item), eq(memories.key, key))).limit(1);
  return row ? toMemory(row) : null;
}

/** F5：同分類內名稱不存在就新增，存在就更新 */
export async function saveMemoryByKey(input: Partial<MemoryInput>): Promise<{ memory: Memory; created: boolean }> {
  const m = cleanMemoryInput(input);
  validate(m);
  const existing = await getMemoryByKey(m.item, m.key);
  if (existing) return { memory: await updateMemory(existing.id, m), created: false };
  return { memory: await createMemory(m), created: true };
}

export async function deleteMemoryByKey(item: string, key: string): Promise<boolean> {
  const rows = await db().delete(memories).where(and(eq(memories.item, item), eq(memories.key, key))).returning({ id: memories.id });
  return rows.length > 0;
}

/** F11 目錄：名稱 + 摘要；即時查詢，不存表 */
export async function memoryIndex(item: string): Promise<{ entries: { key: string; summary: string }[]; items: string[] }> {
  const entries = await db().select({ key: memories.key, summary: memories.summary }).from(memories)
    .where(eq(memories.item, item)).orderBy(asc(memories.key));
  if (entries.length) return { entries, items: [] };
  const items = await db().selectDistinct({ item: memories.item }).from(memories).orderBy(asc(memories.item));
  return { entries, items: items.map((r) => r.item) };
}

// ---- 匯入（F6）----

export type ImportRow = MemoryInput & { updatedAt: string };

/** 整批匯入：overwriteKeys 內的重複名稱覆蓋，其他重複略過；保留檔案中的更新時間 */
export async function importMemories(rows: Partial<ImportRow>[], overwriteKeys: string[]) {
  if (!Array.isArray(rows) || rows.length === 0) throw new ApiError(ERROR_CODE.BAD_REQUEST, "沒有可匯入的記憶。");
  const cleaned = rows.map((r, i) => {
    const m = { ...cleanMemoryInput(r), item: MEMORY_DEFAULT_ITEM };
    const at = new Date(String(r.updatedAt ?? ""));
    try {
      validate(m);
    } catch (e) {
      if (e instanceof ApiError) throw new ApiError(ERROR_CODE.VALIDATION, `第 ${i + 1} 筆有問題：${Object.values(e.fields ?? {}).join("、")}`);
      throw e;
    }
    if (Number.isNaN(at.getTime())) throw new ApiError(ERROR_CODE.VALIDATION, `第 ${i + 1} 筆的更新時間格式不正確。`);
    return { ...m, updatedAt: at };
  });
  // 2026/11/12 - Arlen - Code Review：檔案內同名會讓 batch 撞唯一索引變 500，改回明確的欄位錯誤 - Start
  const seen = new Set<string>();
  cleaned.forEach((m, i) => {
    if (seen.has(m.key)) throw new ApiError(ERROR_CODE.VALIDATION, `第 ${i + 1} 筆的名稱「${m.key}」在檔案中重複。`);
    seen.add(m.key);
  });
  // 2026/11/12 - Arlen - Code Review：檔案內同名會讓 batch 撞唯一索引變 500，改回明確的欄位錯誤 - end
  const overwrite = new Set(overwriteKeys ?? []);
  const existing = new Set((await db().select({ key: memories.key }).from(memories).where(eq(memories.item, MEMORY_DEFAULT_ITEM))).map((r) => r.key));

  let created = 0, overwritten = 0, skipped = 0;
  // neon-http 不支援互動式交易：先算好要寫的列，再用 batch 一次送出
  const ops: BatchItem<"pg">[] = [];
  for (const m of cleaned) {
    if (!existing.has(m.key)) {
      created++;
      ops.push(db().insert(memories).values(m));
    } else if (overwrite.has(m.key)) {
      overwritten++;
      ops.push(db().update(memories).set(m).where(and(eq(memories.item, m.item), eq(memories.key, m.key))));
    } else skipped++;
  }
  if (ops.length) await db().batch(ops as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return { created, overwritten, skipped };
}
