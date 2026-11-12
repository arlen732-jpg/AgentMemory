// 對應驗收測試 E2E-01 通行碼生命週期（FSD §2.2 狀態流轉圖、§2.3 端到端序列圖）
// 主角：一組通行碼；流程：網頁產生（有效）→ AI 使用（更新最後使用時間）→ 網頁撤銷（已撤銷）→ AI 被拒
import { test, expect, type Browser } from '@playwright/test'
import { STATE } from './helpers/auth'
import { revokeAll, uid } from './helpers/api'
import { expectResult } from './helpers/ui'
import { McpClient, rpcPost } from './helpers/mcp'

test.describe.configure({ mode: 'serial' })

async function ownerPage(browser: Browser) {
  const ctx = await browser.newContext({ storageState: STATE.owner })
  return { ctx, page: await ctx.newPage() }
}

test.describe('E2E-01 通行碼生命週期', { tag: '@E2E-01' }, () => {
  const name = uid('e2e')
  let secret = ''

  test.afterAll(async ({ playwright, baseURL }) => {
    const req = await playwright.request.newContext({ baseURL, storageState: STATE.owner })
    const { data } = await (await req.get('/api/tokens')).json()
    await revokeAll(req, (data as { id: string; name: string; revokedAt: string | null }[]).filter((t) => t.name === name && !t.revokedAt).map((t) => t.id))
    await req.dispose()
  })

  test('E2E-01.1 Arlen 在網頁產生通行碼，原文只顯示一次', async ({ browser }) => {
    const { ctx, page } = await ownerPage(browser)
    await page.goto('/tokens')
    await page.getByTestId('token-name-input').fill(name)
    await page.getByTestId('token-create-btn').click()
    secret = (await page.getByTestId('token-secret-value').textContent())!.trim()
    expect(secret).toMatch(/^am_/)
    await page.getByTestId('token-secret-close-btn').click()
    const row = page.getByTestId('token-row').filter({ hasText: name })
    await expect(row).toContainText('有效')   // 狀態：有效
    await expect(row).toContainText('—')       // 尚未使用
    await ctx.close()
  })

  test('E2E-01.2 AI 助手帶通行碼連入 MCP，取得「個人」目錄（交接：網頁 → AI）', async ({ request }) => {
    const mcp = new McpClient(request, secret)
    await mcp.initialize()
    const r = await mcp.call('memory_get', { item: '個人', key: 'index' })
    expect(r.isError).toBe(false)
    expect(r.text).toContain('分類「個人」目錄')
  })

  test('E2E-01.3 網頁列表顯示最後使用時間（副作用）', async ({ browser }) => {
    const { ctx, page } = await ownerPage(browser)
    await page.goto('/tokens')
    const row = page.getByTestId('token-row').filter({ hasText: name })
    const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10).replaceAll('-', '/')
    await expect(row).toContainText(today) // 最後使用 yyyy/MM/dd HH:mm
    await expect(row).toContainText('有效')
    await ctx.close()
  })

  test('E2E-01.4 Arlen 在網頁撤銷通行碼（交接：AI → 網頁）', async ({ browser }) => {
    const { ctx, page } = await ownerPage(browser)
    await page.goto('/tokens')
    const row = page.getByTestId('token-row').filter({ hasText: name })
    await row.getByTestId('token-revoke-btn').click()
    await page.getByTestId('confirm-ok-btn').click()
    await expectResult(page, '已撤銷')
    await expect(row).toContainText('已撤銷')
    await ctx.close()
  })

  test('E2E-01.5 終態：撤銷後 AI 立即無法連入（401）', async ({ request }) => {
    const res = await rpcPost(request, secret, 'tools/list')
    expect(res.status()).toBe(401)
  })
})
