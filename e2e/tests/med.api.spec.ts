// 對應驗收測試 FR-09 網頁吃藥紀錄（F9／REQ-MED-001）
// 規則：服藥時間、藥名、劑量必填；時間不可晚於現在；藥名 ≤ 50、劑量 ≤ 30、備註 ≤ 500（加密儲存）
import { test, expect, type APIRequestContext } from '@playwright/test'
import { ANON } from './helpers/auth'
import { MISSING_ID, cleanup, expectFail, expectOk, minutesAgo, minutesLater, uid } from './helpers/api'

type Med = { id: string; takenAt: string; drug: string; dose: string; note: string }

const created = new Set<string>()
test.afterAll(async ({ request }) => cleanup(request, 'med', created))

async function add(request: APIRequestContext, m: Record<string, unknown>) {
  const res = await request.post('/api/med', { data: m })
  if (res.status() === 201) created.add((await res.json()).data.id)
  return res
}
const base = (extra: Record<string, unknown> = {}) => ({ takenAt: minutesAgo(5), drug: '降血壓藥', dose: '1 顆', note: '', ...extra })

test.describe('FR-09 網頁吃藥紀錄', { tag: '@FR-09' }, () => {
  test('9.1 新增吃藥紀錄回 201，欄位原樣回傳（劑量為自由文字）', async ({ request }) => {
    const m = await expectOk<Med>(await add(request, base({ dose: '半顆', note: '飯後' })), 201)
    expect(m).toMatchObject({ drug: '降血壓藥', dose: '半顆', note: '飯後' })
  })

  test('9.2 曾用藥名清單（/api/med/drugs）包含新藥名，且不重複', async ({ request }) => {
    const drug = uid('藥')
    await expectOk(await add(request, base({ drug })), 201)
    await expectOk(await add(request, base({ drug, takenAt: minutesAgo(10) })), 201)
    const drugs = await expectOk<string[]>(await request.get('/api/med/drugs'))
    expect(drugs.filter((d) => d === drug)).toHaveLength(1)
  })

  test('9.3 依藥名篩選只回傳該藥名', async ({ request }) => {
    const drug = uid('藥')
    const m = await expectOk<Med>(await add(request, base({ drug })), 201)
    const rows = await expectOk<Med[]>(await request.get(`/api/med?drug=${encodeURIComponent(drug)}`))
    expect(rows.map((r) => r.id)).toEqual([m.id])
  })

  test('9.4 依期間篩選（from/to），結果依服藥時間新到舊', async ({ request }) => {
    const m = await expectOk<Med>(await add(request, base({ takenAt: '2025-03-10T08:00:00+08:00' })), 201)
    const inR = await expectOk<Med[]>(await request.get(`/api/med?from=${encodeURIComponent('2025-03-10T00:00:00+08:00')}&to=${encodeURIComponent('2025-03-10T23:59:59+08:00')}`))
    expect(inR.some((r) => r.id === m.id)).toBe(true)
    const outR = await expectOk<Med[]>(await request.get(`/api/med?from=${encodeURIComponent('2025-03-11T00:00:00+08:00')}&to=${encodeURIComponent('2025-03-12T00:00:00+08:00')}`))
    expect(outR.some((r) => r.id === m.id)).toBe(false)
    const all = await expectOk<Med[]>(await request.get('/api/med'))
    const t = all.map((r) => new Date(r.takenAt).getTime())
    expect([...t].sort((a, b) => b - a)).toEqual(t)
  })

  test('9.5 修改吃藥紀錄回 200', async ({ request }) => {
    const m = await expectOk<Med>(await add(request, base()), 201)
    const u = await expectOk<Med>(await request.post(`/api/med/${m.id}/update`, { data: { ...m, dose: '2 顆' } }))
    expect(u).toMatchObject({ id: m.id, dose: '2 顆' })
  })

  test('9.6 刪除回 200，再刪回 404；修改不存在回 404', async ({ request }) => {
    const m = await expectOk<Med>(await add(request, base()), 201)
    await expectOk(await request.post(`/api/med/${m.id}/delete`))
    created.delete(m.id)
    await expectFail(await request.post(`/api/med/${m.id}/delete`), 404, 'not_found')
    await expectFail(await request.post(`/api/med/${MISSING_ID}/update`, { data: base() }), 404, 'not_found')
  })

  test('9.7 服藥時間、藥名、劑量必填（標出缺哪一項）', async ({ request }) => {
    const err = await expectFail(await request.post('/api/med', { data: { takenAt: '', drug: ' ', dose: '' } }), 400, 'validation')
    expect(Object.keys(err.fields ?? {}).sort()).toEqual(['dose', 'drug', 'takenAt'])
  })

  test('9.8 服藥時間在未來或格式錯誤回 400', async ({ request }) => {
    expect((await expectFail(await request.post('/api/med', { data: base({ takenAt: minutesLater(10) }) }), 400, 'validation')).fields?.takenAt).toBeTruthy()
    expect((await expectFail(await request.post('/api/med', { data: base({ takenAt: 'abc' }) }), 400, 'validation')).fields?.takenAt).toBeTruthy()
  })

  test('9.9 長度邊界：藥名 50／51、劑量 30／31、備註 500／501', async ({ request }) => {
    await expectOk(await add(request, base({ drug: (uid('藥') + 'x'.repeat(50)).slice(0, 50) })), 201)
    await expectFail(await request.post('/api/med', { data: base({ drug: 'x'.repeat(51) }) }), 400, 'validation')
    await expectOk(await add(request, base({ dose: 'd'.repeat(30) })), 201)
    await expectFail(await request.post('/api/med', { data: base({ dose: 'd'.repeat(31) }) }), 400, 'validation')
    await expectOk(await add(request, base({ note: '註'.repeat(500) })), 201)
    await expectFail(await request.post('/api/med', { data: base({ note: '註'.repeat(501) }) }), 400, 'validation')
  })
})

test.describe('FR-09 網頁吃藥紀錄 — 欄位資料來源驗證', { tag: '@FR-09' }, () => {
  test('9.F1 列表回傳的服藥時間、藥名、劑量、備註與寫入值相同（來源：med_records，備註解密後一致）', async ({ request }) => {
    const drug = uid('藥')
    const input = base({ takenAt: '2025-03-20T12:45:00+08:00', drug, dose: '1000 IU', note: 'e2e-field-verify-備註' })
    await expectOk<Med>(await add(request, input), 201)
    const rows = await expectOk<Med[]>(await request.get(`/api/med?drug=${encodeURIComponent(drug)}`))
    expect(rows).toHaveLength(1)
    expect(new Date(rows[0].takenAt).toISOString()).toBe(new Date(input.takenAt as string).toISOString())
    expect({ drug: rows[0].drug, dose: rows[0].dose, note: rows[0].note }).toEqual({ drug, dose: '1000 IU', note: 'e2e-field-verify-備註' })
  })
})

test.describe('FR-09 RBAC 拒絕測試', { tag: '@FR-09' }, () => {
  test('9.R1 未登入呼叫吃藥 API（列表／藥名／新增／修改／刪除）一律 401', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON })
    await expectFail(await ctx.get('/api/med'), 401, 'unauthorized')
    await expectFail(await ctx.get('/api/med/drugs'), 401, 'unauthorized')
    await expectFail(await ctx.post('/api/med', { data: base() }), 401, 'unauthorized')
    await expectFail(await ctx.post(`/api/med/${MISSING_ID}/update`, { data: base() }), 401, 'unauthorized')
    await expectFail(await ctx.post(`/api/med/${MISSING_ID}/delete`), 401, 'unauthorized')
    await ctx.dispose()
  })

  test('9.R4 本人呼叫列表與藥名回 200', async ({ request }) => {
    await expectOk(await request.get('/api/med'))
    await expectOk(await request.get('/api/med/drugs'))
  })
})
