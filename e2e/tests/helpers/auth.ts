// 2026/11/12 - Arlen - 身分與 session 簽發
// 本系統只有一個角色（Arlen 本人），LINE OAuth 無法自動化，改由測試自行簽發 Auth.js session JWT：
// - cookie 名稱 authjs.session-token（http://localhost，非 secure）同時作為 encode 的 salt
// - payload 對齊 src/auth.ts：sub = ALLOWED_LINE_USER_ID、name = Arlen（session callback 讀 token.name）
// - maxAge = WEB_SESSION_HOURS（預設 12）小時
import path from 'node:path'
import type { BrowserContextOptions } from '@playwright/test'
import { envInt, requireEnv } from './env'

export const SESSION_COOKIE = 'authjs.session-token'

export const STATE = {
  owner: path.resolve(__dirname, '../../playwright/.auth/owner.json'),
}

/** 未登入 context 用的空白 storageState */
export const ANON: BrowserContextOptions['storageState'] = { cookies: [], origins: [] }

export function sessionMaxAgeSec() {
  return envInt('WEB_SESSION_HOURS', 12) * 3600
}

/** 簽發 session JWT；maxAge 可給負數模擬已過期的 session */
export async function mintSessionToken(opts: { maxAge?: number; sub?: string; secret?: string } = {}) {
  const { encode } = await import('next-auth/jwt')
  return encode({
    salt: SESSION_COOKIE,
    secret: opts.secret ?? requireEnv('AUTH_SECRET'),
    maxAge: opts.maxAge ?? sessionMaxAgeSec(),
    token: { sub: opts.sub ?? requireEnv('ALLOWED_LINE_USER_ID'), name: 'Arlen' },
  })
}

/** 組 storageState 的 cookie 物件（localhost） */
export function sessionCookie(value: string, maxAgeSec = sessionMaxAgeSec()) {
  const host = new URL(process.env.BASE_URL ?? 'http://localhost:3000').hostname
  return {
    name: SESSION_COOKIE,
    value,
    domain: host,
    path: '/',
    expires: Math.floor(Date.now() / 1000) + Math.max(maxAgeSec, 60),
    httpOnly: true,
    secure: false,
    sameSite: 'Lax' as const,
  }
}
