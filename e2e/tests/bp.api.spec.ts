// 對應驗收測試 FR-07 網頁血壓紀錄（F7／REQ-BP-001）
// 規則：收縮壓 50~300、舒張壓 30~200、脈搏 30~250、收縮壓 > 舒張壓、量測時間不可晚於現在、備註 ≤ 500 字（加密儲存）
import { test, expect, type APIRequestContext } from '@playwright/test'
import { ANON } from './helpers/auth'
import { MISSING_ID, cleanup, expectFail, expectOk, minutesAgo, minutesLater, uid } from './helpers/api'

type Bp = { id: string; measuredAt: string; systolic: number; diastolic: number; pulse: number | null; note: string }

const created = new Set<string>()
test.afterAll(async ({ request }) => cleanup(request, 'bp', created))

async function add(request: APIRequestContext, b: Record<string, unknown>) {
  const res = await request.post('/api/bp', { data: b })
  if (res.status() === 201) created.add((await res.json()).data.id)
  return res
}
const base = (extra: Record<string, unknown> = {}) => ({ measuredAt: minutesAgo(5), systolic: 128, diastolic: 82, pulse: 70, note: '', ...extra })

test.describe('FR-07 網頁血壓紀錄', { tag: '@FR-07' }, () => {
  test('7.1 新增血壓回 201，數值與備註原樣回傳', async ({ request }) => {
    const note = `量前喝了咖啡 ${uid()}`
    const b = await expectOk<Bp>(await add(request, base({ note })), 201)
    expect(b).toMatchObject({ systolic: 128, diastolic: 82, pulse: 70, note })
  })

  test('7.2 脈搏與備註可不填（pulse 為 null）', async ({ request }) => {
    const b = await expectOk<Bp>(await add(request, { measuredAt: minutesAgo(6), systolic: 120, diastolic: 80 }), 201)
    expect(b.pulse).toBeNull()
    expect(b.note).toBe('')
  })

  test('7.3 數值可用字串傳入（表單送字串）', async ({ request }) => {
    const b = await expectOk<Bp>(await add(request, base({ systolic: '130', diastolic: '85', pulse: '72' })), 201)
    expect([b.systolic, b.diastolic, b.pulse]).toEqual([130, 85, 72])
  })

  test('7.4 列表依量測時間新到舊；from/to 期間篩選', async ({ request }) => {
    const at = '2025-01-15T08:00:00+08:00'
    const b = await expectOk<Bp>(await add(request, base({ measuredAt: at })), 201)
    const inRange = await expectOk<Bp[]>(await request.get(`/api/bp?from=${encodeURIComponent('2025-01-15T00:00:00+08:00')}&to=${encodeURIComponent('2025-01-15T23:59:59+08:00')}`))
    expect(inRange.some((r) => r.id === b.id)).toBe(true)
    expect(inRange.every((r) => r.measuredAt.startsWith('2025-01-1'))).toBe(true)
    const outRange = await expectOk<Bp[]>(await request.get(`/api/bp?from=${encodeURIComponent('2025-01-16T00:00:00+08:00')}&to=${encodeURIComponent('2025-01-17T00:00:00+08:00')}`))
    expect(outRange.some((r) => r.id === b.id)).toBe(false)
    const all = await expectOk<Bp[]>(await request.get('/api/bp'))
    const t = all.map((r) => new Date(r.measuredAt).getTime())
    expect([...t].sort((x, y) => y - x)).toEqual(t)
  })

  test('7.5 期間參數格式錯誤回 400 validation', async ({ request }) => {
    await expectFail(await request.get('/api/bp?from=not-a-date'), 400, 'validation')
  })

  test('7.6 修改血壓回 200，數值更新', async ({ request }) => {
    const b = await expectOk<Bp>(await add(request, base()), 201)
    const u = await expectOk<Bp>(await request.post(`/api/bp/${b.id}/update`, { data: { ...b, systolic: 140, note: '修改後' } }))
    expect(u).toMatchObject({ id: b.id, systolic: 140, note: '修改後' })
  })

  test('7.7 刪除血壓回 200，再刪回 404', async ({ request }) => {
    const b = await expectOk<Bp>(await add(request, base()), 201)
    await expectOk(await request.post(`/api/bp/${b.id}/delete`))
    created.delete(b.id)
    await expectFail(await request.post(`/api/bp/${b.id}/delete`), 404, 'not_found')
  })

  test('7.8 修改不存在的紀錄回 404 not_found', async ({ request }) => {
    await expectFail(await request.post(`/api/bp/${MISSING_ID}/update`, { data: base() }), 404, 'not_found')
  })

  test('7.9 收縮壓、舒張壓、量測時間必填', async ({ request }) => {
    const err = await expectFail(await request.post('/api/bp', { data: { measuredAt: '', systolic: '', diastolic: '' } }), 400, 'validation')
    expect(Object.keys(err.fields ?? {}).sort()).toEqual(['diastolic', 'measuredAt', 'systolic'])
  })

  test('7.10 收縮壓邊界：49 拒絕、50 與 300 接受、301 拒絕', async ({ request }) => {
    expect((await expectFail(await request.post('/api/bp', { data: base({ systolic: 49, diastolic: 30 }) }), 400, 'validation')).fields?.systolic).toBeTruthy()
    await expectOk(await add(request, base({ systolic: 50, diastolic: 30 })), 201)
    await expectOk(await add(request, base({ systolic: 300, diastolic: 80 })), 201)
    expect((await expectFail(await request.post('/api/bp', { data: base({ systolic: 301 }) }), 400, 'validation')).fields?.systolic).toBeTruthy()
  })

  test('7.11 舒張壓邊界：29 拒絕、30 與 200 接受、201 拒絕', async ({ request }) => {
    expect((await expectFail(await request.post('/api/bp', { data: base({ diastolic: 29 }) }), 400, 'validation')).fields?.diastolic).toBeTruthy()
    await expectOk(await add(request, base({ diastolic: 30 })), 201)
    await expectOk(await add(request, base({ systolic: 250, diastolic: 200 })), 201)
    expect((await expectFail(await request.post('/api/bp', { data: base({ systolic: 250, diastolic: 201 }) }), 400, 'validation')).fields?.diastolic).toBeTruthy()
  })

  test('7.12 脈搏邊界：29 拒絕、30 與 250 接受、251 拒絕', async ({ request }) => {
    expect((await expectFail(await request.post('/api/bp', { data: base({ pulse: 29 }) }), 400, 'validation')).fields?.pulse).toBeTruthy()
    await expectOk(await add(request, base({ pulse: 30 })), 201)
    await expectOk(await add(request, base({ pulse: 250 })), 201)
    expect((await expectFail(await request.post('/api/bp', { data: base({ pulse: 251 }) }), 400, 'validation')).fields?.pulse).toBeTruthy()
  })

  test('7.13 收縮壓必須大於舒張壓（相等也拒絕）', async ({ request }) => {
    const err = await expectFail(await request.post('/api/bp', { data: base({ systolic: 90, diastolic: 90 }) }), 400, 'validation')
    expect(err.fields?.systolic).toContain('大於')
  })

  test('7.14 量測時間在未來回 400', async ({ request }) => {
    const err = await expectFail(await request.post('/api/bp', { data: base({ measuredAt: minutesLater(10) }) }), 400, 'validation')
    expect(err.fields?.measuredAt).toBeTruthy()
  })

  test('7.15 量測時間格式錯誤、數值非整數、負數回 400', async ({ request }) => {
    expect((await expectFail(await request.post('/api/bp', { data: base({ measuredAt: 'yesterday' }) }), 400, 'validation')).fields?.measuredAt).toBeTruthy()
    expect((await expectFail(await request.post('/api/bp', { data: base({ systolic: 120.5 }) }), 400, 'validation')).fields?.systolic).toBeTruthy()
    expect((await expectFail(await request.post('/api/bp', { data: base({ diastolic: -80 }) }), 400, 'validation')).fields?.diastolic).toBeTruthy()
  })

  test('7.16 備註 500 字可存、501 字回 400', async ({ request }) => {
    await expectOk(await add(request, base({ note: '註'.repeat(500) })), 201)
    const err = await expectFail(await request.post('/api/bp', { data: base({ note: '註'.repeat(501) }) }), 400, 'validation')
    expect(err.fields?.note).toContain('500')
  })
})

test.describe('FR-07 網頁血壓紀錄 — 欄位資料來源驗證', { tag: '@FR-07' }, () => {
  test('7.F1 列表回傳的量測時間、三項數值、備註與寫入值相同（來源：bp_records，備註解密後一致）', async ({ request }) => {
    const input = base({ measuredAt: '2025-02-01T07:30:00+08:00', systolic: 133, diastolic: 77, pulse: 66, note: 'e2e-field-verify-備註' })
    const b = await expectOk<Bp>(await add(request, input), 201)
    const rows = await expectOk<Bp[]>(await request.get(`/api/bp?from=${encodeURIComponent('2025-02-01T00:00:00+08:00')}&to=${encodeURIComponent('2025-02-01T23:59:59+08:00')}`))
    const hit = rows.find((r) => r.id === b.id)!
    expect(new Date(hit.measuredAt).toISOString()).toBe(new Date(input.measuredAt as string).toISOString())
    expect({ s: hit.systolic, d: hit.diastolic, p: hit.pulse, n: hit.note }).toEqual({ s: 133, d: 77, p: 66, n: 'e2e-field-verify-備註' })
  })
})

test.describe('FR-07 RBAC 拒絕測試', { tag: '@FR-07' }, () => {
  test('7.R1 未登入呼叫血壓 API（列表／新增／修改／刪除）一律 401', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON })
    await expectFail(await ctx.get('/api/bp'), 401, 'unauthorized')
    await expectFail(await ctx.post('/api/bp', { data: base() }), 401, 'unauthorized')
    await expectFail(await ctx.post(`/api/bp/${MISSING_ID}/update`, { data: base() }), 401, 'unauthorized')
    await expectFail(await ctx.post(`/api/bp/${MISSING_ID}/delete`), 401, 'unauthorized')
    await ctx.dispose()
  })

  test('7.R4 本人呼叫列表回 200', async ({ request }) => {
    expect(Array.isArray(await expectOk<Bp[]>(await request.get('/api/bp')))).toBe(true)
  })
})
