// 對應驗收測試 FR-02 通行碼管理（F2／REQ-SYS-002）
// 通行碼不可刪除（FSD：撤銷後保留在列表），測試建立的通行碼在 afterAll 一律撤銷
import { test, expect } from '@playwright/test'
import { ANON } from './helpers/auth'
import { MISSING_ID, dateAfter, expectFail, expectOk, revokeAll, taipeiDate, uid } from './helpers/api'
import { envInt } from './helpers/env'

type Token = { id: string; name: string; createdAt: string; expiresAt: string; lastUsedAt: string | null; revokedAt: string | null; tokenPreview: string }

const created = new Set<string>()

test.afterAll(async ({ request }) => {
  await revokeAll(request, created)
})

async function create(request: import('@playwright/test').APIRequestContext, data: Record<string, unknown>) {
  const res = await request.post('/api/tokens', { data })
  // APIResponse 的 body 會快取，這裡讀過後呼叫端仍可再 json()
  if (res.status() === 201) created.add((await res.json()).data.token.id)
  return res
}

test.describe('FR-02 通行碼管理', { tag: '@FR-02' }, () => {
  test('2.1 GET /api/tokens 回傳通行碼陣列，不含指紋與原文', async ({ request }) => {
    const rows = await expectOk<Token[]>(await request.get('/api/tokens'))
    expect(Array.isArray(rows)).toBe(true)
    for (const t of rows) {
      expect(t).not.toHaveProperty('tokenHash')
      expect(t).not.toHaveProperty('secret')
    }
  })

  test('2.2 產生通行碼：原文 am_ 開頭、預覽為末 4 碼、到期為台北當日 23:59:59', async ({ request }) => {
    const name = uid('t')
    const expires = dateAfter(10)
    const res = await create(request, { name, expires })
    const data = await expectOk<{ token: Token; secret: string }>(res, 201)
    expect(data.secret).toMatch(/^am_/)
    expect(data.token.name).toBe(name)
    expect(data.token.tokenPreview).toBe(data.secret.slice(-4))
    expect(data.token.revokedAt).toBeNull()
    expect(data.token.lastUsedAt).toBeNull()
    expect(new Date(data.token.expiresAt).toISOString()).toBe(new Date(`${expires}T23:59:59+08:00`).toISOString())
  })

  test('2.3 原文只回傳一次：列表中只有預覽，沒有原文', async ({ request }) => {
    const res = await create(request, { name: uid('t'), expires: dateAfter(5) })
    const { token, secret } = await expectOk<{ token: Token; secret: string }>(res, 201)
    const rows = await expectOk<Token[]>(await request.get('/api/tokens'))
    const hit = rows.find((t) => t.id === token.id)
    expect(hit).toBeDefined()
    expect(JSON.stringify(hit)).not.toContain(secret)
    expect(hit!.tokenPreview).toBe(secret.slice(-4))
  })

  test('2.4 未填到期日時套用 TOKEN_DEFAULT_DAYS', async ({ request }) => {
    const res = await create(request, { name: uid('t') })
    const { token } = await expectOk<{ token: Token }>(res, 201)
    const days = envInt('TOKEN_DEFAULT_DAYS', 90)
    expect(taipeiDate(new Date(token.expiresAt).getTime())).toBe(dateAfter(days))
  })

  test('2.5 名稱空白回 400 validation（fields.name）', async ({ request }) => {
    const err = await expectFail(await request.post('/api/tokens', { data: { name: '   ', expires: dateAfter(5) } }), 400, 'validation')
    expect(err.fields?.name).toBeTruthy()
  })

  test('2.6 名稱 31 字回 400；30 字可產生（邊界）', async ({ request }) => {
    const err = await expectFail(await request.post('/api/tokens', { data: { name: 'n'.repeat(31), expires: dateAfter(5) } }), 400, 'validation')
    expect(err.fields?.name).toContain('30')
    const name30 = (uid('t') + 'x'.repeat(30)).slice(0, 30)
    const ok = await expectOk<{ token: Token }>(await create(request, { name: name30, expires: dateAfter(5) }), 201)
    expect(ok.token.name).toHaveLength(30)
  })

  test('2.7 與有效通行碼同名回 400 validation', async ({ request }) => {
    const name = uid('t')
    await expectOk(await create(request, { name, expires: dateAfter(5) }), 201)
    const err = await expectFail(await request.post('/api/tokens', { data: { name, expires: dateAfter(6) } }), 400, 'validation')
    expect(err.fields?.name).toContain('同名')
  })

  test('2.8 到期日為今天回 400；明天可產生（下限邊界）', async ({ request }) => {
    const err = await expectFail(await request.post('/api/tokens', { data: { name: uid('t'), expires: taipeiDate() } }), 400, 'validation')
    expect(err.fields?.expires).toBeTruthy()
    await expectOk(await create(request, { name: uid('t'), expires: dateAfter(1) }), 201)
  })

  test('2.9 到期日超過 TOKEN_MAX_DAYS 回 400；剛好上限可產生（上限邊界）', async ({ request }) => {
    const max = envInt('TOKEN_MAX_DAYS', 365)
    const err = await expectFail(await request.post('/api/tokens', { data: { name: uid('t'), expires: dateAfter(max + 1) } }), 400, 'validation')
    expect(err.fields?.expires).toContain(String(max))
    await expectOk(await create(request, { name: uid('t'), expires: dateAfter(max) }), 201)
  })

  test('2.10 到期日格式錯誤回 400', async ({ request }) => {
    for (const expires of ['2026/12/01', 'abc', '2026-13-45']) {
      const err = await expectFail(await request.post('/api/tokens', { data: { name: uid('t'), expires } }), 400, 'validation')
      expect(err.fields?.expires, expires).toBeTruthy()
    }
  })

  test('2.11 request body 不是 JSON 回 400 bad_request', async ({ request }) => {
    await expectFail(await request.post('/api/tokens', { headers: { 'Content-Type': 'application/json' }, data: '{bad json' }), 400, 'bad_request')
  })
})

test.describe('FR-02 通行碼狀態流轉', { tag: '@FR-02' }, () => {
  test.describe.configure({ mode: 'serial' })
  let token: Token
  let name: string

  test('2.12 有效 → 已撤銷：撤銷回 200 且 revokedAt 有值', async ({ request }) => {
    name = uid('t')
    token = (await expectOk<{ token: Token }>(await create(request, { name, expires: dateAfter(5) }), 201)).token
    const after = await expectOk<Token>(await request.post(`/api/tokens/${token.id}/revoke`))
    expect(after.id).toBe(token.id)
    expect(after.revokedAt).not.toBeNull()
    const rows = await expectOk<Token[]>(await request.get('/api/tokens'))
    expect(rows.find((t) => t.id === token.id)?.revokedAt).not.toBeNull()
  })

  test('2.13 已撤銷不可再撤銷：回 409 conflict', async ({ request }) => {
    await expectFail(await request.post(`/api/tokens/${token.id}/revoke`), 409, 'conflict')
  })

  test('2.14 撤銷後可再用同名產生新通行碼', async ({ request }) => {
    const data = await expectOk<{ token: Token }>(await create(request, { name, expires: dateAfter(5) }), 201)
    expect(data.token.id).not.toBe(token.id)
  })

  test('2.15 撤銷不存在的通行碼回 404 not_found', async ({ request }) => {
    await expectFail(await request.post(`/api/tokens/${MISSING_ID}/revoke`), 404, 'not_found')
  })
})

test.describe('FR-02 RBAC 拒絕測試', { tag: '@FR-02' }, () => {
  // 單一角色系統：無 403 情境（見對照表說明）
  test('2.R1 未登入 GET /api/tokens 回 401', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON })
    await expectFail(await ctx.get('/api/tokens'), 401, 'unauthorized')
    await ctx.dispose()
  })

  test('2.R2 未登入 POST /api/tokens 回 401 且不產生通行碼', async ({ playwright, baseURL, request }) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON })
    const name = uid('t')
    await expectFail(await ctx.post('/api/tokens', { data: { name, expires: dateAfter(5) } }), 401, 'unauthorized')
    await ctx.dispose()
    const rows = await expectOk<Token[]>(await request.get('/api/tokens'))
    expect(rows.some((t) => t.name === name)).toBe(false)
  })

  test('2.R3 未登入撤銷回 401', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON })
    await expectFail(await ctx.post(`/api/tokens/${MISSING_ID}/revoke`), 401, 'unauthorized')
    await ctx.dispose()
  })

  test('2.R4 本人 GET /api/tokens 回 200', async ({ request }) => {
    await expectOk(await request.get('/api/tokens'))
  })
})
