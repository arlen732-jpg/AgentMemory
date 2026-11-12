// 2026/11/12 - Arlen - MCP 工具（F3、F5、F8、F10、F11；GenWebSite-Analysis §4.2）
// 工具只呼叫 service 層，驗證規則與網頁 API 相同
import "server-only";
import { z } from "zod";
import type { createMcpHandler } from "mcp-handler";
import { bpSummary } from "@/lib/bpStats";
import { startOfTaipeiDaysAgo } from "@/lib/dates";
import { LIMITS, MEMORY_DEFAULT_ITEM, RESERVED_KEY } from "@/lib/validation";
import { createBp, listBp } from "./bp";
import { ApiError, ERROR_CODE } from "./http";
import { createMed, listDrugs, listMed } from "./med";
import { deleteMemoryByKey, getMemoryByKey, listMemories, memoryIndex, saveMemoryByKey } from "./memories";

type Server = Parameters<Parameters<typeof createMcpHandler>[0]>[0];

const SEARCH_LIMIT = 20;
const BP_QUERY_DEFAULT_DAYS = 30;

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const json = (data: unknown) => text(JSON.stringify(data, null, 2));
const fail = (s: string) => ({ ...text(s), isError: true });

/** 業務錯誤轉成工具錯誤訊息；其他錯誤只回通用訊息，不洩漏細節 */
async function run<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return fail([e.message, ...Object.values(e.fields ?? {})].join("\n"));
    console.error("[mcp]", e instanceof Error ? e.message : e);
    return fail("伺服器發生錯誤，請稍後再試。");
  }
}

/** ISO-8601；沒帶時區時視為台北時間 +08:00 */
function parseTime(v: string | undefined, label: string): Date | undefined {
  if (!v) return undefined;
  const s = v.trim();
  const hasTz = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const iso = hasTz ? s : /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00+08:00` : `${s}+08:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new ApiError(ERROR_CODE.VALIDATION, `${label}格式不正確，請用 ISO-8601（例：2026-11-01T08:30:00+08:00）。`);
  return d;
}

const item = z.string().max(20).optional().describe(`分類，預設「${MEMORY_DEFAULT_ITEM}」`);
const time = (d: string) => z.string().max(40).optional().describe(`${d}（ISO-8601；沒帶時區視為 +08:00）`);

export function registerTools(server: Server) {
  // ---- 記憶 ----
  server.registerTool("memory_get", {
    description: `讀取一筆記憶。key="${RESERVED_KEY}" 時回傳該分類的目錄（名稱 + 摘要），建議先看目錄再取需要的那一筆。`,
    inputSchema: z.object({ item, key: z.string().max(LIMITS.memoryKey).describe(`名稱；"${RESERVED_KEY}" 代表目錄`) }),
  }, ({ item: it, key }) => run(async () => {
    const cat = it?.trim() || MEMORY_DEFAULT_ITEM;
    if (key.trim().toLowerCase() === RESERVED_KEY) {
      const { entries, items } = await memoryIndex(cat);
      // 2026/11/12 - Arlen - F11：目錄最後一行提示其他資料的工具 - Start
      const footer = "\n\n其他資料：血壓（bp_*）、吃藥（med_*）";
      if (entries.length) return text(`分類「${cat}」目錄（${entries.length} 筆）：\n` + entries.map((e) => `- ${e.key}：${e.summary}`).join("\n") + footer);
      return text((items.length ? `分類「${cat}」沒有記憶。現有分類：${items.join("、")}` : "記憶庫目前是空的。") + footer);
      // 2026/11/12 - Arlen - F11：目錄最後一行提示其他資料的工具 - end
    }
    const m = await getMemoryByKey(cat, key.trim());
    return m ? json(m) : text(`找不到分類「${cat}」的「${key}」。可先用 key="${RESERVED_KEY}" 查看目錄。`);
  }));

  server.registerTool("memory_search", {
    description: `以關鍵字搜尋記憶的名稱、摘要、內容，最多回傳 ${SEARCH_LIMIT} 筆。`,
    inputSchema: z.object({ query: z.string().min(1).max(100), item }),
  }, ({ query, item: it }) => run(async () => {
    const rows = await listMemories({ q: query, item: it?.trim() || undefined });
    return json({ total: rows.length, items: rows.slice(0, SEARCH_LIMIT) });
  }));

  server.registerTool("memory_save", {
    description: "儲存一筆記憶：同分類內名稱已存在就更新，否則新增。",
    inputSchema: z.object({
      item,
      key: z.string().max(LIMITS.memoryKey),
      summary: z.string().max(LIMITS.memorySummary).describe("一句話說明這筆記憶回答什麼問題"),
      value: z.string().max(LIMITS.memoryValue),
      tags: z.array(z.string().max(LIMITS.tag)).max(LIMITS.tagCount).optional(),
    }),
  }, (a) => run(async () => {
    const { memory, created } = await saveMemoryByKey({ ...a, tags: a.tags ?? [] });
    return text(`${created ? "已新增" : "已更新"}記憶「${memory.key}」（分類「${memory.item}」）。`);
  }));

  server.registerTool("memory_delete", {
    description: "刪除一筆記憶（以分類 + 名稱定位）。",
    inputSchema: z.object({ item, key: z.string().max(LIMITS.memoryKey) }),
  }, ({ item: it, key }) => run(async () => {
    const cat = it?.trim() || MEMORY_DEFAULT_ITEM;
    return text((await deleteMemoryByKey(cat, key.trim())) ? `已刪除「${key}」。` : `找不到分類「${cat}」的「${key}」。`);
  }));

  // ---- 血壓 ----
  server.registerTool("bp_add", {
    description: "新增一筆血壓紀錄。只記錄數字，不做健康判讀。",
    inputSchema: z.object({
      systolic: z.number().int().describe("收縮壓"),
      diastolic: z.number().int().describe("舒張壓"),
      pulse: z.number().int().optional().describe("脈搏"),
      measuredAt: time("量測時間，預設現在"),
      note: z.string().max(LIMITS.note).optional(),
    }),
  }, (a) => run(async () => json(await createBp({
    ...a, measuredAt: (parseTime(a.measuredAt, "量測時間") ?? new Date()).toISOString(),
  }))));

  server.registerTool("bp_query", {
    description: `查詢血壓紀錄（新到舊）；沒給期間時預設最近 ${BP_QUERY_DEFAULT_DAYS} 天。`,
    inputSchema: z.object({ from: time("起始時間"), to: time("結束時間") }),
  }, ({ from, to }) => run(async () => {
    const f = parseTime(from, "起始時間") ?? (to ? undefined : new Date(startOfTaipeiDaysAgo(BP_QUERY_DEFAULT_DAYS)));
    return json(await listBp({ from: f, to: parseTime(to, "結束時間") }));
  }));

  server.registerTool("bp_summary", {
    description: "最近 N 天（含今天，台北時間）的血壓統計：筆數、平均、最高、最低（四捨五入到整數）。",
    inputSchema: z.object({ days: z.number().int().min(1).max(365) }),
  }, ({ days }) => run(async () => json({ days, ...bpSummary(await listBp({ from: new Date(startOfTaipeiDaysAgo(days)) })) })));

  // ---- 吃藥 ----
  server.registerTool("med_add", {
    description: "新增一筆吃藥紀錄。",
    inputSchema: z.object({
      drug: z.string().max(LIMITS.drug).describe("藥名；可先用 med_drugs 取得曾用藥名，保持一致"),
      dose: z.string().max(LIMITS.dose).describe("劑量，例：1 顆、5 mg"),
      takenAt: time("服藥時間，預設現在"),
      note: z.string().max(LIMITS.note).optional(),
    }),
  }, (a) => run(async () => json(await createMed({
    ...a, takenAt: (parseTime(a.takenAt, "服藥時間") ?? new Date()).toISOString(),
  }))));

  server.registerTool("med_query", {
    description: "查詢吃藥紀錄（新到舊），可依期間與藥名篩選。",
    inputSchema: z.object({ from: time("起始時間"), to: time("結束時間"), drug: z.string().max(LIMITS.drug).optional() }),
  }, ({ from, to, drug }) => run(async () =>
    json(await listMed({ from: parseTime(from, "起始時間"), to: parseTime(to, "結束時間"), drug }))));

  server.registerTool("med_drugs", {
    description: "列出曾經記錄過的藥名。",
  }, () => run(async () => json(await listDrugs())));
}
