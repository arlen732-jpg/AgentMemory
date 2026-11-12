// 對應驗收測試 E2E-02 記憶跨網頁與 AI 同步（REQ-MEM-001／002、REQ-SYS-004 驗收標準）
// 主角：一筆記憶；流程：網頁新增 → AI 目錄看到 → AI 取單筆 → AI 更新 → 網頁看到新內容 → 網頁刪除 → AI 找不到
import { test, expect, type Browser } from '@playwright/test'
import { STATE } from './helpers/auth'
import { deleteMemoriesByKey, revokeAll, uid } from './helpers/api'
import { confirmDelete, expectResult } from './helpers/ui'
import { McpClient, createMcpToken } from './helpers/mcp'

test.describe.configure({ mode: 'serial' })

async function ownerPage(browser: Browser) {
  const ctx = await browser.newContext({ storageState: STATE.owner })
  return { ctx, page: await ctx.newPage() }
}

test.describe('E2E-02 記憶跨網頁與 AI 同步', { tag: '@E2E-02' }, () => {
  const key = uid('sync')
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

  test('E2E-02.1 Arlen 在網頁新增記憶', async ({ browser }) => {
    const { ctx, page } = await ownerPage(browser)
    await page.goto('/memories')
    await page.getByTestId('memories-add-btn').click()
    await page.getByTestId('memory-key-input').fill(key)
    await page.getByTestId('memory-summary-input').fill('同步測試摘要')
    await page.getByTestId('memory-value-input').fill('網頁寫入的內容')
    await page.getByTestId('memory-save-btn').click()
    await expectResult(page, '已儲存')
    await expect(page.getByTestId('memory-item').filter({ hasText: key })).toBeVisible()
    await ctx.close()
  })

  test('E2E-02.2 AI 取目錄立即看到新記憶的名稱與摘要，再取單筆內容', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    const dir = await mcp.call('memory_get', { key: 'index' })
    expect(dir.text).toContain(`- ${key}：同步測試摘要`)
    const one = await mcp.callJson<{ value: string }>('memory_get', { key })
    expect(one.value).toBe('網頁寫入的內容')
  })

  test('E2E-02.3 AI 以 memory_save 更新同名記憶（舊內容被取代）', async ({ request }) => {
    const r = await new McpClient(request, tok.secret).call('memory_save', { key, summary: '同步測試摘要', value: 'AI 更新後的內容' })
    expect(r.text).toContain('已更新')
  })

  test('E2E-02.4 網頁重新整理後看到 AI 更新的內容', async ({ browser }) => {
    const { ctx, page } = await ownerPage(browser)
    await page.goto('/memories')
    const card = page.getByTestId('memory-item').filter({ hasText: key })
    await expect(card).toContainText('AI 更新後的內容')
    await expect(page.getByTestId('memory-item').filter({ hasText: key })).toHaveCount(1) // 沒有重複新增
    await ctx.close()
  })

  test('E2E-02.5 Arlen 在網頁刪除該記憶', async ({ browser }) => {
    const { ctx, page } = await ownerPage(browser)
    await page.goto('/memories')
    await page.getByTestId('memory-item').filter({ hasText: key }).click()
    await page.getByTestId('memory-delete-btn').click()
    await confirmDelete(page)
    await expectResult(page, '已刪除')
    await ctx.close()
  })

  test('E2E-02.6 終態：AI 取不到該記憶，目錄也不再列出', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    expect((await mcp.call('memory_get', { key })).text).toContain('找不到')
    expect((await mcp.call('memory_get', { key: 'index' })).text).not.toContain(key)
  })
})
