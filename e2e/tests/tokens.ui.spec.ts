// 對應驗收測試 UI-007 通行碼頁（F2 人機介面、F11 指路牌）
import { test, expect } from '@playwright/test'
import { dateAfter, revokeAll, uid } from './helpers/api'
import { expectResult } from './helpers/ui'

type Token = { id: string; name: string; tokenPreview: string; revokedAt: string | null; expiresAt: string }
const names: string[] = []
test.afterAll(async ({ request }) => {
  const { data } = await (await request.get('/api/tokens')).json()
  await revokeAll(request, (data as Token[]).filter((t) => names.includes(t.name) && !t.revokedAt).map((t) => t.id))
})

test.describe('UI-007 通行碼頁', { tag: '@UI-007' }, () => {
  test('UI-007.1 列表欄位：名稱、狀態、建立日期、到期日、最後使用；到期日預設 TOKEN_DEFAULT_DAYS', async ({ page }) => {
    await page.goto('/tokens')
    await expect(page.getByRole('heading', { level: 1, name: '通行碼' })).toBeVisible()
    for (const h of ['名稱', '狀態', '建立日期', '到期日', '最後使用']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible()
    await expect(page.getByTestId('token-expires-input')).toHaveValue(dateAfter(90))
  })

  test('UI-007.2 產生通行碼：跳窗顯示原文（am_ 開頭）與「關閉後將無法再看到」提示', async ({ page }) => {
    const name = uid('ui')
    names.push(name)
    await page.goto('/tokens')
    await page.getByTestId('token-name-input').fill(name)
    await page.getByTestId('token-create-btn').click()
    const dlg = page.getByTestId('token-secret-dialog')
    await expect(dlg).toBeVisible()
    await expect(dlg).toContainText('關閉後將無法再看到')
    const secret = (await page.getByTestId('token-secret-value').textContent())!.trim()
    expect(secret).toMatch(/^am_/)
    await page.getByTestId('token-secret-close-btn').click()
    await expect(dlg).toBeHidden()
    const row = page.getByTestId('token-row').filter({ hasText: name })
    await expect(row).toContainText('有效')
    await expect(row).toContainText(`…${secret.slice(-4)}`)
    await expect(page.getByText(secret)).toHaveCount(0) // 關閉後頁面不再出現原文
  })

  test('UI-007.3 名稱未填或與有效通行碼同名時，跳窗「產生失敗」並顯示紅字', async ({ page, request }) => {
    const name = uid('ui')
    names.push(name)
    await request.post('/api/tokens', { data: { name, expires: dateAfter(3) } })
    await page.goto('/tokens')
    await page.getByTestId('token-create-btn').click()
    await expectResult(page, '產生失敗')
    await expect(page.getByTestId('token-name-error')).toContainText('請輸入名稱')
    await page.getByTestId('token-name-input').fill(name)
    await page.getByTestId('token-create-btn').click()
    await expectResult(page, '產生失敗')
    await expect(page.getByTestId('token-name-error')).toContainText('同名')
  })

  test('UI-007.4 撤銷須再確認；按取消則維持有效', async ({ page, request }) => {
    const name = uid('ui')
    names.push(name)
    await request.post('/api/tokens', { data: { name, expires: dateAfter(3) } })
    await page.goto('/tokens')
    const row = page.getByTestId('token-row').filter({ hasText: name })
    await row.getByTestId('token-revoke-btn').click()
    await expect(page.getByTestId('confirm-dialog')).toContainText(name)
    await page.getByTestId('confirm-cancel-btn').click()
    await expect(row).toContainText('有效')
  })

  test('UI-007.5 確認撤銷後狀態變「已撤銷」、撤銷按鈕消失、列表保留', async ({ page, request }) => {
    const name = uid('ui')
    names.push(name)
    await request.post('/api/tokens', { data: { name, expires: dateAfter(3) } })
    await page.goto('/tokens')
    const row = page.getByTestId('token-row').filter({ hasText: name })
    await row.getByTestId('token-revoke-btn').click()
    await page.getByTestId('confirm-ok-btn').click()
    await expectResult(page, '已撤銷')
    await expect(row).toContainText('已撤銷')
    await expect(row.getByTestId('token-revoke-btn')).toHaveCount(0)
  })

  test('UI-007.6 指路牌顯示 memory_get(item="個人", key="index") 並可複製', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/tokens')
    await expect(page.getByText('memory_get(item="個人", key="index")')).toBeVisible()
    await page.getByTestId('token-copy-signpost-btn').click()
    await expect(page.getByTestId('token-copy-signpost-btn')).toContainText('已複製')
  })
})

test.describe('UI-007 通行碼頁 — 欄位資料來源驗證', { tag: '@UI-007' }, () => {
  test('UI-007.F1 列表的名稱、末 4 碼、到期日與 API 值相同（來源：api_tokens）', async ({ page, request }) => {
    const name = uid('ui')
    names.push(name)
    const expires = dateAfter(20)
    const { data } = await (await request.post('/api/tokens', { data: { name, expires } })).json()
    const t = data.token as Token
    await page.goto('/tokens')
    const row = page.getByTestId('token-row').filter({ hasText: name })
    await expect(row).toContainText(`…${t.tokenPreview}`)
    await expect(row).toContainText(expires.replaceAll('-', '/'))
  })
})
