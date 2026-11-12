// 2026/11/12 - Arlen - 網頁 API 統一回應格式：{ ok: true, data } / { ok: false, error }
import "server-only";
import { NextResponse } from "next/server";

export const ERROR_CODE = {
  UNAUTHORIZED: "unauthorized",
  VALIDATION: "validation",
  NOT_FOUND: "not_found",
  CONFLICT: "conflict",
  BAD_REQUEST: "bad_request",
  SERVER: "server_error",
} as const;
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401, validation: 400, not_found: 404, conflict: 409, bad_request: 400, server_error: 500,
};

/** 業務錯誤：在 handler 內 throw，由 route() 轉成回應 */
export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

export const ok = <T>(data: T, status = 200) => NextResponse.json({ ok: true, data }, { status });

export function fail(code: ErrorCode, message: string, fields?: Record<string, string>) {
  return NextResponse.json({ ok: false, error: { code, message, fields } }, { status: STATUS[code] ?? 500 });
}

/** 欄位錯誤不為空就丟 400 */
export function assertValid(fields: Record<string, string | undefined>) {
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v)) as Record<string, string>;
  if (Object.keys(clean).length) throw new ApiError(ERROR_CODE.VALIDATION, "有欄位未通過檢查，請依提示修正後重新送出。", clean);
}

// 2026/11/12 - Arlen - Code Review：id 不是 UUID 時 DB 會丟語法錯誤變 500，先擋下改回 404 - Start
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 路由 id 不是 UUID 就當成找不到 */
export function assertId(id: string, notFoundMessage: string) {
  if (!UUID_RE.test(id)) throw new ApiError(ERROR_CODE.NOT_FOUND, notFoundMessage);
}
// 2026/11/12 - Arlen - Code Review：id 不是 UUID 時 DB 會丟語法錯誤變 500，先擋下改回 404 - end

/** 讀 JSON body；格式錯誤回 400 */
export async function readJson<T>(req: Request): Promise<T> {
  // 2026/11/12 - Arlen - BUG-1 body 必須是 JSON 物件；字串、null、陣列一律 400，避免後續讀屬性變 500 - Start
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(ERROR_CODE.BAD_REQUEST, "送出的資料格式不正確。");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new ApiError(ERROR_CODE.BAD_REQUEST, "送出的資料格式不正確。");
  return body as T;
  // 2026/11/12 - Arlen - BUG-1 body 必須是 JSON 物件；字串、null、陣列一律 400，避免後續讀屬性變 500 - end
}

/** 包裝 handler：統一攔截 ApiError；其他錯誤只記訊息，不記 request body（FSD §6.3） */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.code, e.message, e.fields);
      console.error("[api]", e instanceof Error ? e.message : e);
      return fail(ERROR_CODE.SERVER, "系統發生錯誤，請稍後再試。");
    }
  };
}
