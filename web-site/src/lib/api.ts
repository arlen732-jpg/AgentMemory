"use client";

// 2026/11/12 - Arlen - 前端 fetch wrapper：對應 server/http.ts 的 { ok, data | error } 格式
// 401（登入逾時）直接導回登入頁；其他錯誤丟 ClientApiError，欄位錯誤放 fields 給表單顯示紅字

export class ClientApiError extends Error {
  constructor(message: string, public code: string, public fields: Record<string, string> = {}) {
    super(message);
  }
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  } catch {
    throw new ClientApiError("無法連線到伺服器，請檢查網路後再試一次。", "network");
  }
  if (res.status === 401) {
    window.location.assign("/login");
    throw new ClientApiError("登入已逾時，請重新登入。", "unauthorized");
  }
  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ClientApiError("伺服器回應格式不正確，請稍後再試。", "bad_response");
  }
  if (!body.ok) throw new ClientApiError(body.error.message, body.error.code, body.error.fields ?? {});
  return body.data;
}

export const apiGet = <T>(url: string) => request<T>(url);
export const apiPost = <T>(url: string, data?: unknown) =>
  request<T>(url, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });

/** 把錯誤轉成跳窗訊息 */
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "發生未預期的錯誤，請稍後再試。");
