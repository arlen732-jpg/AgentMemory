// 對應驗收測試 UI-001 整體 Layout、登入頁與拒絕頁（F1 人機介面）
import { test, expect } from '@playwright/test'
import { ANON, STATE } from './helpers/auth'

test.describe('UI-001 整體 Layout 與登入門禁畫面', { tag: '@UI-001' }, () => {
  test('UI-001.1 側邊選單列出首頁、記憶、匯入、血壓、吃藥、通行碼', async ({ page }) => {
    await page.goto('/')
    for (const id of ['nav-home', 'nav-memories', 'nav-import', 'nav-bp', 'nav-med', 'nav-tokens']) {
      await expect(page.getByTestId(id).first()).toBeVisible()
    }
    await expect(page.getByTestId('nav-home').first()).toHaveAttribute('aria-current', 'page')
  })

  test('UI-001.2 點選選單切換頁面，目前頁面標示 aria-current', async ({ page }) => {
    await page.goto('/')
    const cases: [string, string, string][] = [
      ['nav-memories', '/memories', '記憶'],
      ['nav-import', '/memories/import', '匯入 memory.json'],
      ['nav-bp', '/bp', '血壓'],
      ['nav-med', '/med', '吃藥'],
      ['nav-tokens', '/tokens', '通行碼'],
    ]
    for (const [id, path, heading] of cases) {
      await page.getByTestId(id).first().click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expect(page.getByTestId(id).first()).toHaveAttribute('aria-current', 'page')
    }
    // 匯入頁時「記憶列表」不應同時亮起
    await page.getByTestId('nav-import').first().click()
    await expect(page.getByTestId('nav-memories').first()).not.toHaveAttribute('aria-current', 'page')
  })

  test('UI-001.3 選單群組可收合與展開', async ({ page }) => {
    await page.goto('/')
    const group = page.getByTestId('nav-group-健康紀錄').first()
    await group.click()
    await expect(group).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('nav-bp')).toHaveCount(0)
    await group.click()
    await expect(group).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('nav-bp').first()).toBeVisible()
  })

  test('UI-001.4 手機寬度使用漢堡選單開關', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.getByTestId('nav-menu-btn').click()
    const menu = page.getByRole('dialog', { name: '主選單' })
    await expect(menu).toBeVisible()
    await menu.getByTestId('nav-med').click()
    await expect(page).toHaveURL(/\/med$/)
    await expect(menu).toBeHidden()
  })

  test('UI-001.5 未登入開啟首頁導向登入頁，只有「用 LINE 登入」按鈕', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ANON })
    const page = await ctx.newPage()
    await page.goto('/memories')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByTestId('login-line-btn')).toHaveText('用 LINE 登入')
    await expect(page.getByRole('heading', { name: '個人記憶庫' })).toBeVisible()
    await expect(page.getByText('不取得 email')).toBeVisible()
    await ctx.close()
  })

  test('UI-001.6 拒絕頁只顯示「此帳號無權使用本系統」與回登入頁連結', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ANON })
    const page = await ctx.newPage()
    await page.goto('/denied')
    const panel = page.getByTestId('denied-panel')
    await expect(panel.getByRole('heading')).toHaveText('此帳號無權使用本系統')
    await page.getByTestId('denied-back-link').click()
    await expect(page).toHaveURL(/\/login$/)
    await ctx.close()
  })

  test('UI-001.7 登出後回到登入頁，再開受保護頁面仍被導回登入頁', async ({ browser }) => {
    // 用獨立 context，避免清掉其他測試共用的 session
    const ctx = await browser.newContext({ storageState: STATE.owner })
    const page = await ctx.newPage()
    await page.goto('/')
    await page.getByTestId('logout-btn').first().click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/tokens')
    await expect(page).toHaveURL(/\/login$/)
    await ctx.close()
  })

  test('UI-001.8 不存在的路徑顯示 404 頁', async ({ page }) => {
    const res = await page.goto('/no-such-page-e2e')
    expect(res?.status()).toBe(404)
  })
})
