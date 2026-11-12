// 對應驗收測試 FR-08 AI 血壓存取（F8／REQ-BP-002）、FR-10 AI 吃藥存取（F10／REQ-MED-002）
// 工具：bp_add / bp_query / bp_summary、med_add / med_query / med_drugs；驗證規則與網頁 API 相同
import { test, expect } from '@playwright/test'
import { cleanup, expectOk, minutesAgo, minutesLater, revokeAll, uid } from './helpers/api'
import { McpClient, createMcpToken } from './helpers/mcp'

type Bp = { id: string; measuredAt: string; systolic: number; diastolic: number; pulse: number | null; note: string }
type Med = { id: string; takenAt: string; drug: string; dose: string; note: string }

let tok: { id: string; secret: string }
const bpIds = new Set<string>()
const medIds = new Set<string>()

test.beforeAll(async ({ request }) => {
  tok = await createMcpToken(request)
})
test.afterAll(async ({ request }) => {
  await cleanup(request, 'bp', bpIds)
  await cleanup(request, 'med', medIds)
  await revokeAll(request, [tok.id])
})

const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)

test.describe('FR-08 AI 血壓存取', { tag: '@FR-08' }, () => {
  test('8.1 bp_add 新增血壓，網頁 API 讀得到同一筆（備註一致）', async ({ request }) => {
    const note = uid('n')
    const b = await new McpClient(request, tok.secret).callJson<Bp>('bp_add', { systolic: 128, diastolic: 82, pulse: 70, note, measuredAt: minutesAgo(3) })
    bpIds.add(b.id)
    expect(b).toMatchObject({ systolic: 128, diastolic: 82, pulse: 70, note })
    const rows = await expectOk<Bp[]>(await request.get('/api/bp'))
    expect(rows.find((r) => r.id === b.id)).toMatchObject({ systolic: 128, diastolic: 82, note })
  })

  test('8.2 bp_add 未給時間時用現在時間', async ({ request }) => {
    const before = Date.now()
    const b = await new McpClient(request, tok.secret).callJson<Bp>('bp_add', { systolic: 121, diastolic: 79 })
    bpIds.add(b.id)
    const t = new Date(b.measuredAt).getTime()
    expect(t).toBeGreaterThanOrEqual(before - 60_000)
    expect(t).toBeLessThanOrEqual(Date.now() + 1_000)
  })

  test('8.3 bp_add 沒帶時區的時間視為台北時間 +08:00', async ({ request }) => {
    const b = await new McpClient(request, tok.secret).callJson<Bp>('bp_add', { systolic: 122, diastolic: 78, measuredAt: '2025-04-01T07:30:00' })
    bpIds.add(b.id)
    expect(new Date(b.measuredAt).toISOString()).toBe(new Date('2025-04-01T07:30:00+08:00').toISOString())
  })

  test('8.4 bp_add 數值超出範圍、收縮壓不大於舒張壓、未來時間一律拒絕', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    for (const args of [
      { systolic: 301, diastolic: 80 },
      { systolic: 120, diastolic: 29 },
      { systolic: 120, diastolic: 80, pulse: 251 },
      { systolic: 80, diastolic: 80 },
      { systolic: 120, diastolic: 80, measuredAt: minutesLater(30) },
      { systolic: 120, diastolic: 80, measuredAt: 'not-a-time' },
    ]) {
      const r = await mcp.call('bp_add', args)
      expect(r.isError, JSON.stringify(args)).toBe(true)
    }
  })

  test('8.5 bp_query 依期間查詢（新到舊）', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    const b = await mcp.callJson<Bp>('bp_add', { systolic: 131, diastolic: 81, measuredAt: '2025-04-02T08:00:00+08:00' })
    bpIds.add(b.id)
    const rows = await mcp.callJson<Bp[]>('bp_query', { from: '2025-04-02', to: '2025-04-02T23:59:59+08:00' })
    expect(rows.some((r) => r.id === b.id)).toBe(true)
    const t = rows.map((r) => new Date(r.measuredAt).getTime())
    expect([...t].sort((x, y) => y - x)).toEqual(t)
  })

  test('8.6 bp_query 未給期間時預設最近 30 天', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    const rows = await mcp.callJson<Bp[]>('bp_query', {})
    const limit = Date.now() - 31 * 86400_000
    expect(rows.every((r) => new Date(r.measuredAt).getTime() >= limit)).toBe(true)
  })

  test('8.7 bp_summary 7 天統計與網頁 API 同期間資料計算結果一致', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    const s = await mcp.callJson<any>('bp_summary', { days: 7 })
    expect(s.days).toBe(7)
    // 台北今天 00:00 往前 6 天
    const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
    const from = new Date(new Date(`${today}T00:00:00+08:00`).getTime() - 6 * 86400_000).toISOString()
    const rows = await expectOk<Bp[]>(await request.get(`/api/bp?from=${encodeURIComponent(from)}`))
    expect(s.count).toBe(rows.length)
    if (rows.length) {
      expect(s.systolic.avg).toBe(avg(rows.map((r) => r.systolic)))
      expect(s.systolic.max).toBe(Math.max(...rows.map((r) => r.systolic)))
      expect(s.diastolic.min).toBe(Math.min(...rows.map((r) => r.diastolic)))
    }
  })

  test('8.8 bp_summary 天數 0 或 366 被拒絕（邊界 1~365）', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    expect((await mcp.call('bp_summary', { days: 0 })).isError).toBe(true)
    expect((await mcp.call('bp_summary', { days: 366 })).isError).toBe(true)
    expect((await mcp.call('bp_summary', { days: 365 })).isError).toBe(false)
  })
})

test.describe('FR-10 AI 吃藥存取', { tag: '@FR-10' }, () => {
  const drug = uid('藥')

  test('10.1 med_add 新增吃藥紀錄，網頁 API 讀得到', async ({ request }) => {
    const m = await new McpClient(request, tok.secret).callJson<Med>('med_add', { drug, dose: '1 顆', takenAt: minutesAgo(2) })
    medIds.add(m.id)
    expect(m).toMatchObject({ drug, dose: '1 顆' })
    const rows = await expectOk<Med[]>(await request.get(`/api/med?drug=${encodeURIComponent(drug)}`))
    expect(rows.map((r) => r.id)).toContain(m.id)
  })

  test('10.2 med_query 依藥名篩選', async ({ request }) => {
    const rows = await new McpClient(request, tok.secret).callJson<Med[]>('med_query', { drug })
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows.every((r) => r.drug === drug)).toBe(true)
  })

  test('10.3 med_query 依期間篩選（今天）', async ({ request }) => {
    const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
    const rows = await new McpClient(request, tok.secret).callJson<Med[]>('med_query', { from: today })
    const start = new Date(`${today}T00:00:00+08:00`).getTime()
    expect(rows.every((r) => new Date(r.takenAt).getTime() >= start)).toBe(true)
  })

  test('10.4 med_drugs 列出曾用藥名（含 seed 的降血壓藥與新藥名）', async ({ request }) => {
    const drugs = await new McpClient(request, tok.secret).callJson<string[]>('med_drugs')
    expect(drugs).toContain(drug)
    expect(drugs).toContain('降血壓藥')
  })

  test('10.5 med_add 缺藥名、缺劑量、未來時間一律拒絕', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    expect((await mcp.call('med_add', { drug: '', dose: '1 顆' })).isError).toBe(true)
    expect((await mcp.call('med_add', { drug: '維他命', dose: '' })).isError).toBe(true)
    expect((await mcp.call('med_add', { drug: '維他命', dose: '1 顆', takenAt: minutesLater(30) })).isError).toBe(true)
  })

  test('10.6 med_add 藥名 51 字被拒絕（邊界）', async ({ request }) => {
    expect((await new McpClient(request, tok.secret).call('med_add', { drug: 'x'.repeat(51), dose: '1 顆' })).isError).toBe(true)
  })
})
