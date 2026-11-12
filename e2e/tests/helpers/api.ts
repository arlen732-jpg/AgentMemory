// 2026/11/12 - Arlen - API 共用工具：回應信封斷言、台北時間、測試資料命名與清理
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test'

/** 不存在但格式合法的 uuid（避免 PostgreSQL 因格式錯誤回 500） */
export const MISSING_ID = '00000000-0000-4000-8000-000000000000'

/** 測試資料唯一前綴（名稱長度有上限，盡量短） */
export const uid = (p = 'e2e') => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

/** 成功信封 { ok: true, data } */
export async function expectOk<T = any>(res: APIResponse, status = 200): Promise<T> {
  expect(res.status(), await res.text()).toBe(status)
  const body = await res.json()
  expect(body.ok).toBe(true)
  return body.data as T
}

/** 失敗信封 { ok: false, error: { code, message, fields } } */
export async function expectFail(res: APIResponse, status: number, code: string) {
  expect(res.status(), await res.text()).toBe(status)
  const body = await res.json()
  expect(body.ok).toBe(false)
  expect(body.error.code).toBe(code)
  expect(typeof body.error.message).toBe('string')
  return body.error as { code: string; message: string; fields?: Record<string, string> }
}

// ---- 台北時間（業務時區固定 +08:00）----
const TZ = 8 * 3600_000
const pad = (n: number) => String(n).padStart(2, '0')

/** 台北日期 yyyy-MM-dd */
export function taipeiDate(ms = Date.now()) {
  const t = new Date(ms + TZ)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}
export const dateAfter = (days: number) => taipeiDate(Date.now() + days * 86400_000)

/** n 分鐘前的 ISO 時間 */
export const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString()
/** n 分鐘後（未來）的 ISO 時間 */
export const minutesLater = (n: number) => new Date(Date.now() + n * 60_000).toISOString()

/** 畫面顯示格式 yyyy/MM/dd HH:mm（台北） */
export function fmtDateTime(iso: string) {
  const t = new Date(new Date(iso).getTime() + TZ)
  return `${t.getUTCFullYear()}/${pad(t.getUTCMonth() + 1)}/${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`
}

// ---- 清理（seed 會因資料表非空而中止，測試建立的資料一律刪除）----
export async function cleanup(request: APIRequestContext, kind: 'memories' | 'bp' | 'med', ids: Iterable<string>) {
  for (const id of ids) await request.post(`/api/${kind}/${id}/delete`)
}

export async function revokeAll(request: APIRequestContext, ids: Iterable<string>) {
  for (const id of ids) await request.post(`/api/tokens/${id}/revoke`)
}

/** 依名稱找記憶並刪除（MCP／匯入建立的資料沒有直接拿到 id） */
export async function deleteMemoriesByKey(request: APIRequestContext, keys: string[]) {
  const res = await request.get('/api/memories')
  if (!res.ok()) return
  const { data } = await res.json()
  for (const m of data as { id: string; key: string }[]) {
    if (keys.includes(m.key)) await request.post(`/api/memories/${m.id}/delete`)
  }
}
