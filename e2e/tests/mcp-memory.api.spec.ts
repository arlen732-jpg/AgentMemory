// 對應驗收測試 FR-05 AI 記憶存取（F5／REQ-MEM-002）、FR-11 依目錄漸進取用記憶（F11／REQ-SYS-004）
// 工具：memory_get / memory_search / memory_save / memory_delete
import { test, expect } from '@playwright/test'
import { deleteMemoriesByKey, expectOk, revokeAll, uid } from './helpers/api'
import { McpClient, createMcpToken } from './helpers/mcp'

type Memory = { id: string; item: string; key: string; summary: string; value: string; tags: string[] }

let tok: { id: string; secret: string }
const keys: string[] = []
const items: string[] = []

test.beforeAll(async ({ request }) => {
  tok = await createMcpToken(request)
})
test.afterAll(async ({ request }) => {
  await deleteMemoriesByKey(request, keys)
  await revokeAll(request, [tok.id])
})

test.describe('FR-05 AI 記憶存取', { tag: '@FR-05' }, () => {
  test.describe.configure({ mode: 'serial' })
  const key = uid('ai')
  keys.push(key)

  test('5.1 memory_save 名稱不存在時新增（分類預設「個人」）', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    const r = await mcp.call('memory_save', { key, summary: 'AI 新增', value: '第一版內容', tags: ['ai'] })
    expect(r.isError, r.text).toBe(false)
    expect(r.text).toContain('已新增')
    expect(r.text).toContain('個人')
    const rows = await expectOk<Memory[]>(await request.get(`/api/memories?q=${encodeURIComponent(key)}`))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key, item: '個人', summary: 'AI 新增', value: '第一版內容', tags: ['ai'] })
  })

  test('5.2 memory_save 同分類同名時更新（不新增第二筆）', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    const r = await mcp.call('memory_save', { key, summary: 'AI 更新', value: '第二版內容' })
    expect(r.text).toContain('已更新')
    const rows = await expectOk<Memory[]>(await request.get(`/api/memories?q=${encodeURIComponent(key)}`))
    expect(rows).toHaveLength(1)
    expect(rows[0].value).toBe('第二版內容')
  })

  test('5.3 memory_get 以分類 + 名稱取得完整內容', async ({ request }) => {
    const m = await new McpClient(request, tok.secret).callJson<Memory>('memory_get', { item: '個人', key })
    expect(m).toMatchObject({ key, item: '個人', value: '第二版內容', summary: 'AI 更新' })
  })

  test('5.4 memory_search 依關鍵字找到記憶（含 total）', async ({ request }) => {
    const r = await new McpClient(request, tok.secret).callJson<{ total: number; items: Memory[] }>('memory_search', { query: key })
    expect(r.total).toBe(1)
    expect(r.items[0].key).toBe(key)
  })

  test('5.5 memory_get 不存在的名稱回報「找不到」', async ({ request }) => {
    const r = await new McpClient(request, tok.secret).call('memory_get', { key: uid('none') })
    expect(r.text).toContain('找不到')
  })

  test('5.6 memory_save 名稱為 index 被拒絕', async ({ request }) => {
    const r = await new McpClient(request, tok.secret).call('memory_save', { key: 'index', summary: '保留字', value: 'x' })
    expect(r.isError).toBe(true)
    expect(r.text).toContain('index')
  })

  test('5.7 memory_save 缺摘要或內容被拒絕', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    const a = await mcp.call('memory_save', { key: uid('ai'), summary: '', value: '內容' })
    expect(a.isError).toBe(true)
    const b = await mcp.call('memory_save', { key: uid('ai'), summary: '摘要', value: '' })
    expect(b.isError).toBe(true)
  })

  test('5.8 memory_save 摘要超過 30 字被拒絕（邊界）', async ({ request }) => {
    const r = await new McpClient(request, tok.secret).call('memory_save', { key: uid('ai'), summary: '摘'.repeat(31), value: 'x' })
    expect(r.isError).toBe(true)
  })

  test('5.9 memory_delete 刪除後再刪回報「找不到」', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    expect((await mcp.call('memory_delete', { key })).text).toContain('已刪除')
    expect((await mcp.call('memory_delete', { key })).text).toContain('找不到')
    const rows = await expectOk<Memory[]>(await request.get(`/api/memories?q=${encodeURIComponent(key)}`))
    expect(rows).toHaveLength(0)
  })
})

test.describe('FR-11 依目錄漸進取用記憶', { tag: '@FR-11' }, () => {
  test.describe.configure({ mode: 'serial' })
  const item = uid('cat').slice(0, 20)
  const k1 = uid('dir')
  const k2 = uid('dir')
  keys.push(k1, k2)
  items.push(item)

  test('11.1 新增記憶後，目錄（key=index）立即列出名稱與摘要', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    await mcp.call('memory_save', { item, key: k1, summary: '摘要一', value: 'v1' })
    await mcp.call('memory_save', { item, key: k2, summary: '摘要二', value: 'v2' })
    const r = await mcp.call('memory_get', { item, key: 'index' })
    expect(r.isError).toBe(false)
    expect(r.text).toContain(`分類「${item}」目錄（2 筆）`)
    expect(r.text).toContain(`- ${k1}：摘要一`)
    expect(r.text).toContain(`- ${k2}：摘要二`)
    expect(r.text).not.toContain('v1') // 目錄只給摘要，不給內容
  })

  test('11.2 key 大小寫不同（INDEX）也視為目錄', async ({ request }) => {
    const r = await new McpClient(request, tok.secret).call('memory_get', { item, key: 'INDEX' })
    expect(r.text).toContain('目錄（2 筆）')
  })

  test('11.3 「個人」分類目錄包含 seed 記憶（例：上班時間）', async ({ request }) => {
    const r = await new McpClient(request, tok.secret).call('memory_get', { key: 'index' })
    expect(r.text).toContain('分類「個人」目錄')
    expect(r.text).toContain('- 上班時間：工作時段')
  })

  test('11.6 目錄最後附「其他資料：血壓（bp_*）、吃藥（med_*）」（FSD F11）', async ({ request }) => {
    const r = await new McpClient(request, tok.secret).call('memory_get', { key: 'index' })
    expect(r.text).toContain('bp_')
    expect(r.text).toContain('med_')
  })

  test('11.4 刪除記憶後目錄立即反映', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    await mcp.call('memory_delete', { item, key: k2 })
    const r = await mcp.call('memory_get', { item, key: 'index' })
    expect(r.text).toContain('目錄（1 筆）')
    expect(r.text).not.toContain(k2)
  })

  test('11.5 分類沒有記憶時回報並列出現有分類', async ({ request }) => {
    const r = await new McpClient(request, tok.secret).call('memory_get', { item: uid('empty').slice(0, 20), key: 'index' })
    expect(r.text).toContain('沒有記憶')
    expect(r.text).toContain('現有分類')
    expect(r.text).toContain('個人')
    expect(r.text).toContain(item)
  })
})
