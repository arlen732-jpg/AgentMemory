// 對應驗收測試 FR-01 LINE 登入門禁（F1／REQ-SYS-001）
// LINE OAuth 與 signIn 門禁 callback 無法自動化（見 _Project/驗收測試清單.md 手動項目）；
// 本檔驗證「登入狀態」的守門行為：有效 session 才能取資料、過期或偽造的 session 一律拒絕
import { test, expect } from '@playwright/test'
import { ANON, SESSION_COOKIE, mintSessionToken } from './helpers/auth'
import { expectFail } from './helpers/api'

test.describe('FR-01 LINE 登入門禁', { tag: '@FR-01' }, () => {
  test('1.1 有效 session 取得 /api/auth/session，名稱為 Arlen 且不含 email', async ({ request }) => {
    const res = await request.get('/api/auth/session')
    expect(res.status()).toBe(200)
    const s = await res.json()
    expect(s.user.name).toBe('Arlen')
    expect(s.user.email ?? '').toBe('')
    expect(new Date(s.expires).getTime()).toBeGreaterThan(Date.now())
  })

  test('1.2 未登入時 /api/auth/session 沒有使用者', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON })
    const res = await ctx.get('/api/auth/session')
    expect(res.status()).toBe(200)
    const s = await res.json()
    expect(s?.user).toBeUndefined()
    await ctx.dispose()
  })

  test('1.3 未登入開啟受保護頁面被導向 /login', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON })
    for (const p of ['/', '/memories', '/bp', '/med', '/tokens', '/memories/import']) {
      const res = await ctx.get(p, { maxRedirects: 0 })
      expect([302, 303, 307, 308], p).toContain(res.status())
      expect(new URL(res.headers()['location'], baseURL).pathname, p).toBe('/login')
    }
    await ctx.dispose()
  })

  test('1.4 /login 與 /denied 不需登入即可開啟', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON })
    for (const p of ['/login', '/denied']) {
      const res = await ctx.get(p, { maxRedirects: 0 })
      expect(res.status(), p).toBe(200)
    }
    await ctx.dispose()
  })

  test('1.5 已過期的 session（超過 WEB_SESSION_HOURS）呼叫 API 回 401', async ({ playwright, baseURL }) => {
    const expired = await mintSessionToken({ maxAge: -60 })
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON, extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${expired}` } })
    await expectFail(await ctx.get('/api/memories'), 401, 'unauthorized')
    await ctx.dispose()
  })

  test('1.6 用錯誤金鑰簽發的 session 呼叫 API 回 401', async ({ playwright, baseURL }) => {
    const forged = await mintSessionToken({ secret: 'not-the-real-secret-0123456789abcdef' })
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON, extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${forged}` } })
    await expectFail(await ctx.get('/api/memories'), 401, 'unauthorized')
    await ctx.dispose()
  })

  test('1.7 竄改過的 session cookie 呼叫 API 回 401', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON, extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=garbage.token.value` } })
    await expectFail(await ctx.get('/api/bp'), 401, 'unauthorized')
    await ctx.dispose()
  })
})

test.describe('FR-01 RBAC 拒絕測試', { tag: '@FR-01' }, () => {
  // 系統只有單一角色（Arlen），無 403 情境；以「未登入 401／本人 200」覆蓋
  const endpoints = ['/api/memories', '/api/bp', '/api/med', '/api/med/drugs', '/api/tokens']

  test('1.R1 未登入呼叫所有受保護的 GET API 回 401 unauthorized', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON })
    for (const p of endpoints) await expectFail(await ctx.get(p), 401, 'unauthorized')
    await ctx.dispose()
  })

  test('1.R4 本人 session 呼叫所有 GET API 回 200', async ({ request }) => {
    for (const p of endpoints) {
      const res = await request.get(p)
      expect(res.status(), p).toBe(200)
      expect((await res.json()).ok, p).toBe(true)
    }
  })
})
