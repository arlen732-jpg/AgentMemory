// 對應驗收測試 UI-002 首頁儀表板
import { test, expect } from '@playwright/test'

test.describe('UI-002 首頁儀表板', { tag: '@UI-002' }, () => {
  test('UI-002.1 問候語含 Arlen，顯示四張統計卡', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-banner').getByRole('heading')).toContainText('Arlen')
    for (const id of ['home-stat-memories', 'home-stat-bp', 'home-stat-med', 'home-stat-tokens']) {
      await expect(page.getByTestId(id)).toBeVisible()
    }
  })

  test('UI-002.2 統計卡連到對應頁面', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('home-stat-bp').click()
    await expect(page).toHaveURL(/\/bp$/)
  })

  test('UI-002.3 顯示「今天的吃藥紀錄」與「最近更新的記憶」區塊', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '今天的吃藥紀錄' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '最近更新的記憶' })).toBeVisible()
  })
})

test.describe('UI-002 首頁儀表板 — 欄位資料來源驗證', { tag: '@UI-002' }, () => {
  test('UI-002.F1 記憶筆數與記憶列表 API 一致（來源：memories）', async ({ page, request }) => {
    const { data } = await (await request.get('/api/memories')).json()
    await page.goto('/')
    await expect(page.getByTestId('home-stat-memories')).toContainText(String(data.length))
    await expect(page.getByTestId('home-banner')).toContainText(`目前有 ${data.length} 筆記憶`)
  })

  test('UI-002.F2 有效通行碼數與通行碼 API 一致（來源：api_tokens，未撤銷且未過期）', async ({ page, request }) => {
    const { data } = await (await request.get('/api/tokens')).json()
    const active = (data as { revokedAt: string | null; expiresAt: string }[])
      .filter((t) => !t.revokedAt && new Date(t.expiresAt).getTime() > Date.now()).length
    await page.goto('/')
    await expect(page.getByTestId('home-stat-tokens')).toContainText(String(active))
    await expect(page.getByTestId('home-banner')).toContainText(`${active} 組有效通行碼`)
  })

  test('UI-002.F3 最近更新的記憶顯示更新時間最新的 4 筆名稱', async ({ page, request }) => {
    const { data } = await (await request.get('/api/memories')).json()
    const top = (data as { key: string; updatedAt: string }[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
    await page.goto('/')
    const card = page.locator('section', { has: page.getByRole('heading', { name: '最近更新的記憶' }) })
    for (const m of top) await expect(card).toContainText(m.key)
  })
})
