// 2026/11/12 - Arlen - 通行碼（F2、F3）：只存 SHA-256 指紋，原文只在產生時回傳一次
import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { apiTokens } from "@/db/schema";
import { endOfTaipeiDay, toDateInput } from "@/lib/dates";
import { TOKEN_DEFAULT_DAYS, TOKEN_MAX_DAYS, TOKEN_STATUS, tokenStatus } from "@/lib/tokens";
import type { ApiToken } from "@/lib/types";
import { LIMITS } from "@/lib/validation";
import { hashToken, newTokenPlain } from "./crypto";
import { db } from "./db";
import { ApiError, assertId, assertValid, ERROR_CODE } from "./http";

type Row = typeof apiTokens.$inferSelect;

const toToken = (r: Row): ApiToken => ({
  id: r.id, name: r.name, tokenPreview: r.tokenPreview,
  createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString(),
  lastUsedAt: r.lastUsedAt?.toISOString() ?? null, revokedAt: r.revokedAt?.toISOString() ?? null,
});

/** 環境變數可覆寫天數；不合法時退回預設常數 */
function envDays(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

const dateAfter = (days: number) => toDateInput(Date.now() + days * 86400_000);

export async function listTokens(): Promise<ApiToken[]> {
  const rows = await db().select().from(apiTokens).orderBy(desc(apiTokens.createdAt));
  return rows.map(toToken);
}

/** 產生：名稱不可與有效通行碼重名；到期日（台北日期 yyyy-MM-dd）介於明天 ~ 上限天數 */
export async function createToken(input: { name?: string; expires?: string }): Promise<{ token: ApiToken; secret: string }> {
  const name = String(input.name ?? "").trim();
  const maxDays = envDays("TOKEN_MAX_DAYS", TOKEN_MAX_DAYS);
  const expires = String(input.expires ?? "").trim() || dateAfter(envDays("TOKEN_DEFAULT_DAYS", TOKEN_DEFAULT_DAYS));

  const e: Record<string, string | undefined> = {};
  if (!name) e.name = "請輸入名稱";
  else if (name.length > LIMITS.tokenName) e.name = `名稱最多 ${LIMITS.tokenName} 字`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || Number.isNaN(new Date(`${expires}T00:00:00+08:00`).getTime())) e.expires = "到期日格式不正確";
  else if (expires < dateAfter(1)) e.expires = "到期日至少是明天";
  else if (expires > dateAfter(maxDays)) e.expires = `到期日最多 ${maxDays} 天後`;
  assertValid(e);

  const now = new Date();
  const [dup] = await db().select({ id: apiTokens.id }).from(apiTokens)
    .where(and(eq(apiTokens.name, name), isNull(apiTokens.revokedAt), gt(apiTokens.expiresAt, now))).limit(1);
  if (dup) assertValid({ name: "已有同名的有效通行碼" });

  const secret = newTokenPlain();
  const [row] = await db().insert(apiTokens).values({
    name, tokenHash: hashToken(secret), tokenPreview: secret.slice(-4), expiresAt: new Date(endOfTaipeiDay(expires)),
  }).returning();
  return { token: toToken(row), secret };
}

/** 撤銷：只有有效的通行碼可撤銷，撤銷後不可恢復 */
export async function revokeToken(id: string): Promise<ApiToken> {
  assertId(id, "找不到這組通行碼。"); // 2026/11/12 - Arlen - 非 UUID 回 404
  const [row] = await db().select().from(apiTokens).where(eq(apiTokens.id, id)).limit(1);
  if (!row) throw new ApiError(ERROR_CODE.NOT_FOUND, "找不到這組通行碼。");
  if (tokenStatus(toToken(row)) !== TOKEN_STATUS.ACTIVE) throw new ApiError(ERROR_CODE.CONFLICT, "這組通行碼已失效，不需要再撤銷。");
  const [updated] = await db().update(apiTokens).set({ revokedAt: new Date() }).where(eq(apiTokens.id, id)).returning();
  return toToken(updated);
}

/** MCP 驗證（F3）：Bearer 原文 → 指紋比對；有效才回傳 id，並更新最後使用時間 */
export async function verifyBearer(plain: string): Promise<string | null> {
  if (!plain.startsWith("am_")) return null;
  const now = new Date();
  const [row] = await db().select({ id: apiTokens.id }).from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hashToken(plain)), isNull(apiTokens.revokedAt), gt(apiTokens.expiresAt, now))).limit(1);
  if (!row) return null;
  await db().update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, row.id));
  return row.id;
}
