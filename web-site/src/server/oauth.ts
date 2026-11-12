// 2026/11/12 - Arlen - OAuth 2.1 授權伺服器（手機版 Claude 自訂連接器）
// - 只支援 authorization_code + PKCE(S256)，公開 client（無 client_secret），不發刷新權杖
// - 發出的存取權杖就是一般的 am_ 通行碼，存進 api_tokens，/api/mcp 與「通行碼」頁沿用既有邏輯
// - redirect_uri 只接受 Claude 官方回呼網址，避免任何人註冊 client 騙取授權碼
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { apiTokens, oauthClients, oauthCodes } from "@/db/schema";
import { endOfTaipeiDay, toDateInput } from "@/lib/dates";
import { TOKEN_MAX_DAYS } from "@/lib/tokens";
import { hashToken, newTokenPlain } from "./crypto";
import { db } from "./db";

/** 允許的回呼網址（Claude 網頁版／手機 App 共用） */
export const ALLOWED_REDIRECT_URIS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
] as const;

export const OAUTH_PATH = {
  AUTHORIZE: "/oauth/authorize",
  TOKEN: "/api/oauth/token",
  REGISTER: "/api/oauth/register",
} as const;

const CODE_TTL_MS = 10 * 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43,128}$/;

/** OAuth 標準錯誤（RFC 6749 §5.2） */
export class OAuthError extends Error {
  constructor(public error: string, public description: string, public status = 400) {
    super(description);
  }
}

export const oauthJson = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });

export const oauthFail = (e: unknown) => {
  if (e instanceof OAuthError) return oauthJson({ error: e.error, error_description: e.description }, e.status);
  console.error("[oauth]", e instanceof Error ? e.message : e);
  return oauthJson({ error: "server_error", error_description: "系統發生錯誤，請稍後再試。" }, 500);
};

/** 授權伺服器設定（RFC 8414） */
export function authServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}${OAUTH_PATH.AUTHORIZE}`,
    token_endpoint: `${origin}${OAUTH_PATH.TOKEN}`,
    registration_endpoint: `${origin}${OAUTH_PATH.REGISTER}`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [],
  };
}

/** 動態註冊（RFC 7591）：回呼網址必須全部在白名單內 */
export async function registerClient(input: Record<string, unknown>) {
  const uris = input.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || !uris.every((u) => typeof u === "string"))
    throw new OAuthError("invalid_redirect_uri", "缺少 redirect_uris。");
  if (!uris.every((u) => (ALLOWED_REDIRECT_URIS as readonly string[]).includes(u)))
    throw new OAuthError("invalid_redirect_uri", "不接受這個回呼網址。");
  const name = String(input.client_name ?? "").trim().slice(0, 100) || "Claude";

  const [row] = await db().insert(oauthClients).values({ name, redirectUris: uris as string[] }).returning();
  return {
    client_id: row.id,
    client_name: row.name,
    redirect_uris: row.redirectUris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    client_id_issued_at: Math.floor(row.createdAt.getTime() / 1000),
  };
}

export type AuthorizeRequest = { clientId: string; clientName: string; redirectUri: string; state: string; codeChallenge: string };

/**
 * 檢查授權請求。
 * client 或 redirect_uri 不對時丟 OAuthError（不可導回，只能在頁面顯示）；
 * 其他參數錯誤回傳 redirectError，由呼叫端導回 redirect_uri 並附 error。
 */
export async function checkAuthorize(p: Record<string, string | undefined>):
  Promise<{ req: AuthorizeRequest; redirectError?: string }> {
  const clientId = p.client_id ?? "";
  const redirectUri = p.redirect_uri ?? "";
  if (!UUID_RE.test(clientId)) throw new OAuthError("invalid_client", "找不到這個應用程式，請回到 Claude 重新連接。");
  const [client] = await db().select().from(oauthClients).where(eq(oauthClients.id, clientId)).limit(1);
  if (!client) throw new OAuthError("invalid_client", "找不到這個應用程式，請回到 Claude 重新連接。");
  if (!client.redirectUris.includes(redirectUri)) throw new OAuthError("invalid_request", "回呼網址不符，請回到 Claude 重新連接。");

  const req: AuthorizeRequest = {
    clientId, clientName: client.name, redirectUri, state: p.state ?? "", codeChallenge: p.code_challenge ?? "",
  };
  if (p.response_type !== "code") return { req, redirectError: "unsupported_response_type" };
  if (p.code_challenge_method !== "S256" || !CHALLENGE_RE.test(req.codeChallenge)) return { req, redirectError: "invalid_request" };
  return { req };
}

/** 組回呼網址：附上 code 或 error，以及原本的 state */
export function callbackUrl(redirectUri: string, params: Record<string, string>, state: string) {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

/** 發授權碼（使用者按「允許」後） */
export async function issueCode(r: AuthorizeRequest): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  await db().insert(oauthCodes).values({
    codeHash: hashToken(code), clientId: r.clientId, redirectUri: r.redirectUri,
    codeChallenge: r.codeChallenge, expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return code;
}

/** 環境變數可覆寫天數；不合法時退回預設常數（與 server/tokens.ts 相同規則） */
function maxDays() {
  const n = Number(process.env.TOKEN_MAX_DAYS);
  return Number.isInteger(n) && n > 0 ? n : TOKEN_MAX_DAYS;
}

/** 授權碼換存取權杖：授權碼原子性作廢，PKCE 驗證通過才發 am_ 通行碼 */
export async function exchangeCode(p: Record<string, string>) {
  if (p.grant_type !== "authorization_code") throw new OAuthError("unsupported_grant_type", "只支援 authorization_code。");
  const { code = "", redirect_uri = "", client_id = "", code_verifier = "" } = p;
  if (!code || !code_verifier) throw new OAuthError("invalid_request", "缺少 code 或 code_verifier。");

  const now = new Date();
  // 先作廢再檢查：同一組授權碼不論成功與否都只能用一次
  const [row] = await db().update(oauthCodes).set({ usedAt: now })
    .where(and(eq(oauthCodes.codeHash, hashToken(code)), isNull(oauthCodes.usedAt), gt(oauthCodes.expiresAt, now)))
    .returning();
  if (!row) throw new OAuthError("invalid_grant", "授權碼無效或已過期。");
  if (row.clientId !== client_id || row.redirectUri !== redirect_uri) throw new OAuthError("invalid_grant", "授權碼與 client 不符。");
  const challenge = createHash("sha256").update(code_verifier, "utf8").digest("base64url");
  if (challenge !== row.codeChallenge) throw new OAuthError("invalid_grant", "code_verifier 不正確。");

  const [client] = await db().select({ name: oauthClients.name }).from(oauthClients).where(eq(oauthClients.id, row.clientId)).limit(1);
  const days = maxDays();
  const expiresAt = new Date(endOfTaipeiDay(toDateInput(Date.now() + days * 86400_000)));
  const secret = newTokenPlain();
  await db().insert(apiTokens).values({
    name: `連接器：${client?.name ?? "Claude"}`.slice(0, 30),
    tokenHash: hashToken(secret), tokenPreview: secret.slice(-4), expiresAt,
  });
  return {
    access_token: secret,
    token_type: "Bearer",
    expires_in: Math.max(1, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)),
  };
}
