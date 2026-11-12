// 對應驗收測試 E2E-03 AI 記錄健康數據、網頁查看（REQ-BP-002、REQ-MED-002 驗收標準；FSD §2.3 序列圖後段）
// 主角：一筆血壓 + 一筆吃藥；流程：AI 記錄 → 網頁出現 → AI 統計與網頁一致 → 網頁刪除 → AI 查不到
import { test, expect, type Browser } from '@playwright/test'
import { STATE } from './helpers/auth'
import { cleanup, revokeAll, uid } from './helpers/api'
import { confirmDelete, expectResult } from './helpers/ui'
import { McpClient, createMcpToken } from './helpers/mcp'

test.describe.configure({ mode: 'serial' })

async function ownerPage(browser: Browser) {
  const ctx = await browser.newContext({ storageState: STATE.owner })
  return { ctx, page: await ctx.newPage() }
}

test.describe('E2E-03 AI 記錄健康數據、網頁查看', { tag: '@E2E-03' }, () => {
  const note = uid('ai-bp')
  const drug = uid('藥')
  let tok: { id: string; secret: string }
  let bpId = ''
  let medId = ''

  test.beforeAll(async ({ playwright, baseURL }) => {
    const req = await playwright.request.newContext({ baseURL, storageState: STATE.owner })
    tok = await createMcpToken(req)
    await req.dispose()
  })
  test.afterAll(async ({ playwright, baseURL }) => {
    const req = await playwright.request.newContext({ baseURL, storageState: STATE.owner })
    await cleanup(req, 'bp', bpId ? [bpId] : [])
    await cleanup(req, 'med', medId ? [medId] : [])
    await revokeAll(req, [tok.id])
    await req.dispose()
  })

  test('E2E-03.1 AI 記錄「128/82，心跳 70」與「吃了藥 1 顆」', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    const bp = await mcp.callJson<{ id: string }>('bp_add', { systolic: 128, diastolic: 82, pulse: 70, note })
    bpId = bp.id
    const med = await mcp.callJson<{ id: string }>('med_add', { drug, dose: '1 顆' })
    medId = med.id
  })

  test('E2E-03.2 網頁血壓頁出現該筆（交接：AI → 網頁），7 天統計筆數與 AI 一致', async ({ browser, request }) => {
    const { ctx, page } = await ownerPage(browser)
    await page.goto('/bp')
    await page.getByTestId('bp-period-7').click()
    const row = page.getByTestId('bp-row').filter({ hasText: note })
    await expect(row).toContainText('128')
    await expect(row).toContainText('82')
    await expect(row).toContainText('70')
    const s = await new McpClient(request, tok.secret).callJson<{ count: number; systolic: { avg: number } }>('bp_summary', { days: 7 })
    await expect(page.getByTestId('bp-row')).toHaveCount(s.count)
    await expect(page.getByTestId('bp-summary')).toContainText(String(s.systolic.avg))
    await ctx.close()
  })

  test('E2E-03.3 網頁吃藥頁出現該筆，藥名下拉也出現新藥名', async ({ browser }) => {
    const { ctx, page } = await ownerPage(browser)
    await page.goto('/med')
    await expect(page.getByTestId('med-row').filter({ hasText: drug })).toContainText('1 顆')
    await expect(page.getByTestId('med-drug-select').locator('option', { hasText: drug })).toHaveCount(1)
    await ctx.close()
  })

  test('E2E-03.4 Arlen 在網頁刪除這兩筆', async ({ browser }) => {
    const { ctx, page } = await ownerPage(browser)
    await page.goto('/bp')
    await page.getByTestId('bp-row').filter({ hasText: note }).click()
    await page.getByTestId('bp-delete-btn').click()
    await confirmDelete(page)
    await expectResult(page, '已刪除')
    await page.goto('/med')
    await page.getByTestId('med-row').filter({ hasText: drug }).click()
    await page.getByTestId('med-delete-btn').click()
    await confirmDelete(page)
    await expectResult(page, '已刪除')
    bpId = ''
    medId = ''
    await ctx.close()
  })

  test('E2E-03.5 終態：AI 查詢不到已刪除的紀錄', async ({ request }) => {
    const mcp = new McpClient(request, tok.secret)
    const bps = await mcp.callJson<{ note: string }[]>('bp_query', {})
    expect(bps.some((b) => b.note === note)).toBe(false)
    const meds = await mcp.callJson<unknown[]>('med_query', { drug })
    expect(meds).toHaveLength(0)
  })
})
