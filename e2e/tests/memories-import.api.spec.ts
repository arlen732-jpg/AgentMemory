// 對應驗收測試 FR-06 匯入既有記憶（F6／REQ-MEM-003）
// API：POST /api/memories/import { rows, overwriteKeys }；分類一律「個人」、保留檔案中的更新時間
// 只使用本測試自建的名稱，不覆蓋 seed 資料
import { test, expect } from '@playwright/test'
import { ANON } from './helpers/auth'
import { deleteMemoriesByKey, expectFail, expectOk, uid } from './helpers/api'

type Memory = { id: string; item: string; key: string; summary: string; value: string; tags: string[]; updatedAt: string }
const keys: string[] = []
test.afterAll(async ({ request }) => deleteMemoriesByKey(request, keys))

const row = (key: string, extra: Record<string, unknown> = {}) => ({
  key, summary: '匯入摘要', value: `匯入內容 ${key}`, tags: ['匯入'], updatedAt: '2026-07-06T10:51:46+08:00', ...extra,
})

test.describe('FR-06 匯入既有記憶', { tag: '@FR-06' }, () => {
  test.describe.configure({ mode: 'serial' })
  const k1 = uid('imp')
  const k2 = uid('imp')
  keys.push(k1, k2)

  test('6.1 匯入新記憶：回報新增筆數，分類強制為「個人」，保留原更新時間', async ({ request }) => {
    const r = await expectOk<{ created: number; overwritten: number; skipped: number }>(
      await request.post('/api/memories/import', { data: { rows: [row(k1, { item: '工作' }), row(k2)], overwriteKeys: [] } }))
    expect(r).toEqual({ created: 2, overwritten: 0, skipped: 0 })
    const list = await expectOk<Memory[]>(await request.get('/api/memories'))
    const m1 = list.find((m) => m.key === k1)!
    expect(m1.item).toBe('個人')
    expect(new Date(m1.updatedAt).toISOString()).toBe(new Date('2026-07-06T10:51:46+08:00').toISOString())
    expect(m1.tags).toEqual(['匯入'])
  })

  test('6.2 重複名稱未列入 overwriteKeys 時略過，內容不變', async ({ request }) => {
    const r = await expectOk(await request.post('/api/memories/import', { data: { rows: [row(k1, { value: '不該寫入' })], overwriteKeys: [] } }))
    expect(r).toEqual({ created: 0, overwritten: 0, skipped: 1 })
    const list = await expectOk<Memory[]>(await request.get('/api/memories'))
    expect(list.find((m) => m.key === k1)!.value).toBe(`匯入內容 ${k1}`)
  })

  test('6.3 重複名稱列入 overwriteKeys 時覆蓋，更新時間採檔案值', async ({ request }) => {
    const at = '2026-08-01T09:00:00+08:00'
    const r = await expectOk(await request.post('/api/memories/import', { data: { rows: [row(k2, { value: '覆蓋後內容', updatedAt: at })], overwriteKeys: [k2] } }))
    expect(r).toEqual({ created: 0, overwritten: 1, skipped: 0 })
    const m = (await expectOk<Memory[]>(await request.get('/api/memories'))).find((x) => x.key === k2)!
    expect(m.value).toBe('覆蓋後內容')
    expect(new Date(m.updatedAt).toISOString()).toBe(new Date(at).toISOString())
  })

  test('6.4 沒有任何列回 400 bad_request', async ({ request }) => {
    await expectFail(await request.post('/api/memories/import', { data: { rows: [], overwriteKeys: [] } }), 400, 'bad_request')
  })

  test('6.5 任一筆不合法（摘要 1 字）整份不匯入，訊息指出第幾筆', async ({ request }) => {
    const ok = uid('imp')
    keys.push(ok)
    const err = await expectFail(await request.post('/api/memories/import', {
      data: { rows: [row(ok), row(uid('imp'), { summary: '短' })], overwriteKeys: [] },
    }), 400, 'validation')
    expect(err.message).toContain('第 2 筆')
    const list = await expectOk<Memory[]>(await request.get('/api/memories'))
    expect(list.some((m) => m.key === ok)).toBe(false)
  })

  test('6.6 更新時間格式錯誤回 400，訊息指出第幾筆', async ({ request }) => {
    const err = await expectFail(await request.post('/api/memories/import', {
      data: { rows: [row(uid('imp'), { updatedAt: 'not-a-date' })], overwriteKeys: [] },
    }), 400, 'validation')
    expect(err.message).toContain('第 1 筆')
  })

  test('6.7 名稱為保留字 index 回 400', async ({ request }) => {
    await expectFail(await request.post('/api/memories/import', { data: { rows: [row('index')], overwriteKeys: [] } }), 400, 'validation')
  })
})

test.describe('FR-06 RBAC 拒絕測試', { tag: '@FR-06' }, () => {
  test('6.R1 未登入匯入回 401', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON })
    await expectFail(await ctx.post('/api/memories/import', { data: { rows: [row(uid('imp'))], overwriteKeys: [] } }), 401, 'unauthorized')
    await ctx.dispose()
  })
})
