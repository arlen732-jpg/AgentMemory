// 對應驗收測試 UI-005 血壓頁（F7 人機介面、§5.1 血壓趨勢）
import { test, expect } from '@playwright/test'
import { cleanup, fmtDateTime, minutesAgo, uid } from './helpers/api'
import { confirmDelete, expectResult, localInputMinutesAgo } from './helpers/ui'

type Bp = { id: string; measuredAt: string; systolic: number; diastolic: number; pulse: number | null; note: string }
const ids = new Set<string>()
const notes: string[] = []
test.afterAll(async ({ request }) => {
  const { data } = await (await request.get('/api/bp')).json()
  for (const r of data as Bp[]) if (notes.includes(r.note)) ids.add(r.id)
  await cleanup(request, 'bp', ids)
})

test.describe('UI-005 血壓頁', { tag: '@UI-005' }, () => {
  test('UI-005.1 預設期間 30 天，顯示統計、趨勢圖（三條線）與列表', async ({ page }) => {
    await page.goto('/bp')
    await expect(page.getByRole('heading', { level: 1, name: '血壓' })).toBeVisible()
    await expect(page.getByTestId('bp-period-30')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('bp-summary')).toBeVisible()
    const chart = page.getByTestId('bp-chart')
    await expect(chart).toBeVisible()
    for (const s of ['收縮壓', '舒張壓', '脈搏']) await expect(chart).toContainText(s)
    await expect(page.getByTestId('bp-row').first()).toBeVisible()
  })

  test('UI-005.2 不做健康判讀：畫面不出現「偏高」「正常」等字樣', async ({ page }) => {
    await page.goto('/bp')
    await expect(page.getByTestId('bp-summary')).toBeVisible()
    await expect(page.getByText(/偏高|偏低|正常|異常/)).toHaveCount(0)
  })

  test('UI-005.3 切換期間 7 天，列表筆數與 API 同期間一致', async ({ page, request }) => {
    const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
    const from = new Date(new Date(`${today}T00:00:00+08:00`).getTime() - 6 * 86400_000).toISOString()
    const { data } = await (await request.get(`/api/bp?from=${encodeURIComponent(from)}`)).json()
    await page.goto('/bp')
    await page.getByTestId('bp-period-7').click()
    await expect(page.getByTestId('bp-period-7')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('bp-row')).toHaveCount(data.length)
  })

  test('UI-005.4 自訂期間（沒有資料的日期）顯示空狀態', async ({ page }) => {
    await page.goto('/bp')
    await page.getByTestId('bp-period-custom').click()
    await page.getByTestId('bp-from-input').fill('2020-01-01')
    await page.getByTestId('bp-to-input').fill('2020-01-02')
    await expect(page.getByTestId('empty-state')).toContainText('這段期間沒有血壓紀錄')
  })

  test('UI-005.5 新增血壓：儲存後跳窗「已儲存」並出現在列表', async ({ page }) => {
    const note = uid('ui')
    notes.push(note)
    await page.goto('/bp')
    await page.getByTestId('bp-add-btn').click()
    await expect(page.getByTestId('bp-drawer')).toContainText('新增血壓')
    await expect(page.getByTestId('bp-measuredAt-input')).not.toHaveValue('')
    await page.getByTestId('bp-measuredAt-input').fill(localInputMinutesAgo(2))
    await page.getByTestId('bp-systolic-input').fill('127')
    await page.getByTestId('bp-diastolic-input').fill('83')
    await page.getByTestId('bp-pulse-input').fill('71')
    await page.getByTestId('bp-note-input').fill(note)
    await page.getByTestId('bp-save-btn').click()
    await expectResult(page, '已儲存')
    const row = page.getByTestId('bp-row').filter({ hasText: note })
    await expect(row).toContainText('127')
    await expect(row).toContainText('83')
    await expect(row).toContainText('71')
  })

  test('UI-005.6 收縮壓不大於舒張壓、超出範圍時顯示紅字', async ({ page }) => {
    await page.goto('/bp')
    await page.getByTestId('bp-add-btn').click()
    await page.getByTestId('bp-systolic-input').fill('80')
    await page.getByTestId('bp-diastolic-input').fill('90')
    await page.getByTestId('bp-save-btn').click()
    await expectResult(page, '儲存失敗')
    await expect(page.getByTestId('bp-systolic-error')).toContainText('大於')
    await page.getByTestId('bp-systolic-input').fill('120')
    await page.getByTestId('bp-diastolic-input').fill('80')
    await page.getByTestId('bp-pulse-input').fill('300')
    await page.getByTestId('bp-save-btn').click()
    await expectResult(page, '儲存失敗')
    await expect(page.getByTestId('bp-pulse-error')).toContainText('30~250')
  })

  test('UI-005.7 必填未填顯示紅字；數值欄只接受數字', async ({ page }) => {
    await page.goto('/bp')
    await page.getByTestId('bp-add-btn').click()
    await page.getByTestId('bp-systolic-input').fill('ab')
    await expect(page.getByTestId('bp-systolic-input')).toHaveValue('')
    await page.getByTestId('bp-save-btn').click()
    await expectResult(page, '儲存失敗')
    await expect(page.getByTestId('bp-systolic-error')).toBeVisible()
    await expect(page.getByTestId('bp-diastolic-error')).toBeVisible()
  })

  test('UI-005.8 修改與刪除：刪除須輸入「刪除」確認', async ({ page, request }) => {
    const note = uid('ui')
    const res = await request.post('/api/bp', { data: { measuredAt: minutesAgo(4), systolic: 118, diastolic: 76, pulse: 68, note } })
    ids.add((await res.json()).data.id)
    await page.goto('/bp')
    await page.getByTestId('bp-row').filter({ hasText: note }).getByTestId('bp-row-edit-btn').click()
    await expect(page.getByTestId('bp-drawer')).toContainText('修改血壓')
    await expect(page.getByTestId('bp-systolic-input')).toHaveValue('118')
    await page.getByTestId('bp-systolic-input').fill('119')
    await page.getByTestId('bp-save-btn').click()
    await expectResult(page, '已儲存')
    await expect(page.getByTestId('bp-row').filter({ hasText: note })).toContainText('119')
    await page.getByTestId('bp-row').filter({ hasText: note }).click()
    await page.getByTestId('bp-delete-btn').click()
    await confirmDelete(page)
    await expectResult(page, '已刪除')
    await expect(page.getByTestId('bp-row').filter({ hasText: note })).toHaveCount(0)
  })
})

test.describe('UI-005 血壓頁 — 欄位資料來源驗證', { tag: '@UI-005' }, () => {
  test('UI-005.F1 列表的量測時間、數值、備註與 API 值相同（來源：bp_records）', async ({ page, request }) => {
    const note = `e2e-field-verify-${uid()}`
    const res = await request.post('/api/bp', { data: { measuredAt: minutesAgo(8), systolic: 141, diastolic: 91, pulse: null, note } })
    const b = (await res.json()).data as Bp
    ids.add(b.id)
    await page.goto('/bp')
    const row = page.getByTestId('bp-row').filter({ hasText: note })
    await expect(row).toContainText(fmtDateTime(b.measuredAt))
    await expect(row).toContainText('141')
    await expect(row).toContainText('91')
    await expect(row).toContainText('—') // 脈搏未填
  })

  test('UI-005.F2 統計卡筆數與列表筆數一致', async ({ page }) => {
    await page.goto('/bp')
    const n = await page.getByTestId('bp-row').count()
    await expect(page.getByTestId('bp-summary')).toContainText(String(n))
  })
})
