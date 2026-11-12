// 對應驗收測試 E2E-04 匯入 memory.json 後 AI 依目錄取用（UC4 → UC8；REQ-MEM-003、REQ-SYS-004）
// 主角：一份 memory.json；流程：網頁上傳 → 預覽填摘要 → 確認匯入 → 網頁列表 → AI 目錄 → AI 取單筆
import { test, expect } from '@playwright/test'
import { STATE } from './helpers/auth'
import { deleteMemoriesByKey, revokeAll, uid } from './helpers/api'
import { McpClient, createMcpToken } from './helpers/mcp'

test.describe.configure({ mode: 'serial' })

test.describe('E2E-04 匯入記憶後 AI 依目錄取用', { tag: '@E2E-04' }, () => {
  const key = uid('json')
  let tok: { id: string; secret: string }

  test.beforeAll(async ({ playwright, baseURL }) => {
    const req = await playwright.request.newContext({ baseURL, storageState: STATE.owner })
    tok = await createMcpToken(req)
    await req.dispose()
  })
  test.afterAll(async ({ playwright, baseURL }) => {
    const req = await playwright.request.newContext({ baseURL, storageState: STATE.owner })
    await deleteMemoriesByKey(req, [key])
    await revokeAll(req, [tok.id])
    await req.dispose()
  })

  test('E2E-04.1 Arlen 上傳 memory.json、填摘要並確認匯入', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.owner })
    const page = await ctx.newPage()
    await page.goto('/memories/import', { waitUntil: 'networkidle' })
    const file = [{ key, value: '匯入後 AI 要讀到的內容', tags: ['匯入'], updatedAt: '2026-07-06T15:26:37+08:00' }]
    await page.getByTestId('import-file-input').setInputFiles({ name: 'memory.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
    await page.getByTestId('import-summary-input').fill('匯入情境摘要')
    await page.getByTestId('import-confirm-btn').click()
    await expect(page.getByTestId('submit-result-dialog')).toContainText('新增 1 筆')
    await page.getByTestId('submit-result-ok-btn').click()
    await expect(page).toHaveURL(/\/memories$/)
    const card = page.getByTestId('memory-item').filter({ hasText: key })
    await expect(card).toContainText('個人')
    await expect(card).toContainText('2026/07/06 15:26') // 保留原更新時間
    await ctx.close()
  })

  test('E2E-04.2 AI 取「個人」目錄看到匯入的名稱與摘要（交接：網頁 → AI）', async ({ request }) => {
    const r = await new McpClient(request, tok.secret).call('memory_get', { item: '個人', key: 'index' })
    expect(r.text).toContain(`- ${key}：匯入情境摘要`)
  })

  test('E2E-04.3 終態：AI 依目錄取單筆，內容與檔案一致', async ({ request }) => {
    const m = await new McpClient(request, tok.secret).callJson<{ value: string; item: string; tags: string[] }>('memory_get', { item: '個人', key })
    expect(m).toMatchObject({ value: '匯入後 AI 要讀到的內容', item: '個人', tags: ['匯入'] })
  })
})
