// 對應驗收測試 FR-04 網頁記憶管理（F4／REQ-MEM-001）
// 規則來源：FSD F4 + src/lib/validation.ts（LIMITS、保留字 index、同分類名稱唯一）
import { test, expect, type APIRequestContext } from '@playwright/test'
import { ANON } from './helpers/auth'
import { MISSING_ID, cleanup, expectFail, expectOk, uid } from './helpers/api'

type Memory = { id: string; item: string; key: string; summary: string; value: string; tags: string[]; updatedAt: string }

const created = new Set<string>()
test.afterAll(async ({ request }) => cleanup(request, 'memories', created))

async function add(request: APIRequestContext, m: Partial<Memory> & Record<string, unknown>) {
  const res = await request.post('/api/memories', { data: m })
  if (res.status() === 201) created.add((await res.json()).data.id)
  return res
}
const base = () => ({ key: uid('m'), summary: '測試摘要', value: '測試內容', tags: ['e2e'] })

test.describe('FR-04 網頁記憶管理', { tag: '@FR-04' }, () => {
  test('4.1 新增記憶回 201，字串去頭尾空白、標籤去重', async ({ request }) => {
    const key = uid('m')
    const m = await expectOk<Memory>(await add(request, { key: `  ${key}  `, summary: ' 工作時段 ', value: ' 09:00 ', tags: ['a', ' a ', 'b'] }), 201)
    expect(m.key).toBe(key)
    expect(m.summary).toBe('工作時段')
    expect(m.value).toBe('09:00')
    expect(m.tags).toEqual(['a', 'b'])
    expect(m.item).toBe('個人')
  })

  test('4.2 分類未填時預設為「個人」（MEMORY_DEFAULT_ITEM）', async ({ request }) => {
    const m = await expectOk<Memory>(await add(request, { ...base(), item: '' }), 201)
    expect(m.item).toBe('個人')
  })

  test('4.3 列表依更新時間新到舊，包含剛建立的記憶', async ({ request }) => {
    const m = await expectOk<Memory>(await add(request, base()), 201)
    const rows = await expectOk<Memory[]>(await request.get('/api/memories'))
    expect(rows.some((r) => r.id === m.id)).toBe(true)
    const times = rows.map((r) => new Date(r.updatedAt).getTime())
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  test('4.4 關鍵字搜尋比對名稱、摘要與內容', async ({ request }) => {
    const kw = uid('kw')
    const a = await expectOk<Memory>(await add(request, { ...base(), key: `${kw}k` }), 201)
    const b = await expectOk<Memory>(await add(request, { ...base(), summary: `${kw}`.slice(0, 30) }), 201)
    const c = await expectOk<Memory>(await add(request, { ...base(), value: `內容含 ${kw}` }), 201)
    const rows = await expectOk<Memory[]>(await request.get(`/api/memories?q=${encodeURIComponent(kw)}`))
    expect(rows.map((r) => r.id).sort()).toEqual([a.id, b.id, c.id].sort())
  })

  test('4.5 依分類與標籤篩選', async ({ request }) => {
    const tag = uid('tg').slice(0, 20)
    const item = uid('it').slice(0, 20)
    const m = await expectOk<Memory>(await add(request, { ...base(), item, tags: [tag] }), 201)
    const byTag = await expectOk<Memory[]>(await request.get(`/api/memories?tag=${encodeURIComponent(tag)}`))
    expect(byTag.map((r) => r.id)).toEqual([m.id])
    const byItem = await expectOk<Memory[]>(await request.get(`/api/memories?item=${encodeURIComponent(item)}`))
    expect(byItem.map((r) => r.id)).toEqual([m.id])
  })

  test('4.6 修改記憶回 200，內容更新且更新時間變新', async ({ request }) => {
    const m = await expectOk<Memory>(await add(request, base()), 201)
    const u = await expectOk<Memory>(await request.post(`/api/memories/${m.id}/update`, { data: { ...m, value: '新內容' } }))
    expect(u.value).toBe('新內容')
    expect(new Date(u.updatedAt).getTime()).toBeGreaterThan(new Date(m.updatedAt).getTime())
  })

  test('4.7 刪除記憶回 200，再刪一次回 404', async ({ request }) => {
    const m = await expectOk<Memory>(await add(request, base()), 201)
    await expectOk(await request.post(`/api/memories/${m.id}/delete`))
    created.delete(m.id)
    await expectFail(await request.post(`/api/memories/${m.id}/delete`), 404, 'not_found')
  })

  test('4.8 修改不存在的記憶回 404 not_found', async ({ request }) => {
    await expectFail(await request.post(`/api/memories/${MISSING_ID}/update`, { data: base() }), 404, 'not_found')
  })

  test('4.9 名稱、摘要、內容必填（400 validation 並標出欄位）', async ({ request }) => {
    const err = await expectFail(await request.post('/api/memories', { data: { key: '', summary: '', value: '' } }), 400, 'validation')
    expect(Object.keys(err.fields ?? {}).sort()).toEqual(['key', 'summary', 'value'])
  })

  test('4.10 名稱為保留字 index（不分大小寫）回 400', async ({ request }) => {
    for (const key of ['index', 'INDEX', ' Index ']) {
      const err = await expectFail(await request.post('/api/memories', { data: { ...base(), key } }), 400, 'validation')
      expect(err.fields?.key, key).toContain('index')
    }
  })

  test('4.11 同分類名稱重複回 400；不同分類可同名', async ({ request }) => {
    const m = await expectOk<Memory>(await add(request, base()), 201)
    const err = await expectFail(await request.post('/api/memories', { data: { ...base(), key: m.key } }), 400, 'validation')
    expect(err.fields?.key).toContain('同名')
    await expectOk(await add(request, { ...base(), key: m.key, item: uid('it').slice(0, 20) }), 201)
  })

  test('4.12 修改成同分類既有名稱回 400', async ({ request }) => {
    const a = await expectOk<Memory>(await add(request, base()), 201)
    const b = await expectOk<Memory>(await add(request, base()), 201)
    const err = await expectFail(await request.post(`/api/memories/${b.id}/update`, { data: { ...b, key: a.key } }), 400, 'validation')
    expect(err.fields?.key).toBeTruthy()
  })

  test('4.13 名稱長度邊界：50 字可存、51 字回 400', async ({ request }) => {
    const k50 = (uid('m') + 'k'.repeat(50)).slice(0, 50)
    await expectOk(await add(request, { ...base(), key: k50 }), 201)
    const err = await expectFail(await request.post('/api/memories', { data: { ...base(), key: 'k'.repeat(51) } }), 400, 'validation')
    expect(err.fields?.key).toContain('50')
  })

  test('4.14 摘要長度邊界：1 字回 400、2 字與 30 字可存、31 字回 400', async ({ request }) => {
    await expectFail(await request.post('/api/memories', { data: { ...base(), summary: '短' } }), 400, 'validation')
    await expectOk(await add(request, { ...base(), summary: '兩字' }), 201)
    await expectOk(await add(request, { ...base(), summary: '摘'.repeat(30) }), 201)
    const err = await expectFail(await request.post('/api/memories', { data: { ...base(), summary: '摘'.repeat(31) } }), 400, 'validation')
    expect(err.fields?.summary).toContain('30')
  })

  test('4.15 內容長度邊界：2000 字可存、2001 字回 400', async ({ request }) => {
    await expectOk(await add(request, { ...base(), value: 'v'.repeat(2000) }), 201)
    const err = await expectFail(await request.post('/api/memories', { data: { ...base(), value: 'v'.repeat(2001) } }), 400, 'validation')
    expect(err.fields?.value).toContain('2000')
  })

  test('4.16 標籤上限：10 個可存、11 個回 400；單一標籤 21 字回 400', async ({ request }) => {
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`)
    await expectOk(await add(request, { ...base(), tags: ten }), 201)
    await expectFail(await request.post('/api/memories', { data: { ...base(), tags: [...ten, 't10'] } }), 400, 'validation')
    const err = await expectFail(await request.post('/api/memories', { data: { ...base(), tags: ['x'.repeat(21)] } }), 400, 'validation')
    expect(err.fields?.tags).toContain('20')
  })

  test('4.17 特殊字元（%、_、引號、emoji）可存可搜尋', async ({ request }) => {
    const key = `${uid('m')}%_'"😀`
    const m = await expectOk<Memory>(await add(request, { ...base(), key }), 201)
    expect(m.key).toBe(key)
    const rows = await expectOk<Memory[]>(await request.get(`/api/memories?q=${encodeURIComponent("%_'")}`))
    expect(rows.some((r) => r.id === m.id)).toBe(true)
  })

  test('4.18 request body 不是 JSON 回 400 bad_request', async ({ request }) => {
    await expectFail(await request.post('/api/memories', { headers: { 'Content-Type': 'application/json' }, data: 'not json' }), 400, 'bad_request')
  })
})

test.describe('FR-04 網頁記憶管理 — 欄位資料來源驗證', { tag: '@FR-04' }, () => {
  // 無 DB helper（DB 連線由 Keel MCP 控管），採 §8c 退版：寫入後由列表 API 讀回比對（來源：memories）
  test('4.F1 列表顯示的名稱、摘要、內容、分類、標籤與建立時相同（來源：memories）', async ({ request }) => {
    const input = { key: uid('m'), summary: '欄位來源驗證', value: 'e2e-field-verify-內容', tags: ['來源'], item: '個人' }
    const m = await expectOk<Memory>(await add(request, input), 201)
    const rows = await expectOk<Memory[]>(await request.get('/api/memories'))
    const hit = rows.find((r) => r.id === m.id)!
    expect({ key: hit.key, summary: hit.summary, value: hit.value, tags: hit.tags, item: hit.item }).toEqual(input)
    expect(hit.updatedAt).toBe(m.updatedAt)
  })
})

test.describe('FR-04 RBAC 拒絕測試', { tag: '@FR-04' }, () => {
  test('4.R1 未登入呼叫記憶 API（列表／新增／修改／刪除）一律 401', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ANON })
    await expectFail(await ctx.get('/api/memories'), 401, 'unauthorized')
    await expectFail(await ctx.post('/api/memories', { data: base() }), 401, 'unauthorized')
    await expectFail(await ctx.post(`/api/memories/${MISSING_ID}/update`, { data: base() }), 401, 'unauthorized')
    await expectFail(await ctx.post(`/api/memories/${MISSING_ID}/delete`), 401, 'unauthorized')
    await ctx.dispose()
  })

  test('4.R4 本人呼叫列表回 200', async ({ request }) => {
    const rows = await expectOk<Memory[]>(await request.get('/api/memories'))
    expect(Array.isArray(rows)).toBe(true)
  })
})
