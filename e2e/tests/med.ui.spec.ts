// 對應驗收測試 UI-006 吃藥頁（F9 人機介面）
import { test, expect } from '@playwright/test'
import { cleanup, minutesAgo, uid } from './helpers/api'
import { confirmDelete, expectResult, localInputMinutesAgo } from './helpers/ui'

type Med = { id: string; takenAt: string; drug: string; dose: string; note: string }
const ids = new Set<string>()
const drugs: string[] = []
test.afterAll(async ({ request }) => {
  const { data } = await (await request.get('/api/med')).json()
  for (const r of data as Med[]) if (drugs.includes(r.drug)) ids.add(r.id)
  await cleanup(request, 'med', ids)
})

test.describe('UI-006 吃藥頁', { tag: '@UI-006' }, () => {
  test('UI-006.1 預設期間 30 天，依日期分組顯示，筆數與 API 一致', async ({ page, request }) => {
    const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
    const from = new Date(new Date(`${today}T00:00:00+08:00`).getTime() - 29 * 86400_000).toISOString()
    const { data } = await (await request.get(`/api/med?from=${encodeURIComponent(from)}`)).json()
    await page.goto('/med')
    await expect(page.getByRole('heading', { level: 1, name: '吃藥' })).toBeVisible()
    await expect(page.getByTestId('med-period-30')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('med-count')).toHaveText(`共 ${data.length} 筆`)
  })

  test('UI-006.2 藥名下拉列出曾用藥名，選擇後只顯示該藥', async ({ page }) => {
    await page.goto('/med')
    await expect(page.getByTestId('med-drug-select').locator('option', { hasText: '魚油' })).toHaveCount(1)
    await page.getByTestId('med-drug-select').selectOption('魚油')
    const rows = page.getByTestId('med-row')
    await expect(rows.first()).toBeVisible()
    const n = await rows.count()
    for (let i = 0; i < n; i++) await expect(rows.nth(i)).toContainText('魚油')
  })

  test('UI-006.3 新增吃藥紀錄：藥名提示、儲存後出現在列表', async ({ page }) => {
    const drug = uid('藥')
    drugs.push(drug)
    await page.goto('/med')
    await page.getByTestId('med-add-btn').click()
    await expect(page.getByTestId('med-drawer')).toContainText('新增吃藥紀錄')
    await expect(page.getByTestId('med-drug-input')).toHaveAttribute('list', 'med-drug-list')
    await page.getByTestId('med-takenAt-input').fill(localInputMinutesAgo(1))
    await page.getByTestId('med-drug-input').fill(drug)
    await page.getByTestId('med-dose-input').fill('5 mg')
    await page.getByTestId('med-note-input').fill('飯後')
    await page.getByTestId('med-save-btn').click()
    await expectResult(page, '已儲存')
    const row = page.getByTestId('med-row').filter({ hasText: drug })
    await expect(row).toContainText('5 mg')
    await expect(row).toContainText('飯後')
  })

  test('UI-006.4 必填未填顯示紅字', async ({ page }) => {
    await page.goto('/med')
    await page.getByTestId('med-add-btn').click()
    await page.getByTestId('med-save-btn').click()
    await expectResult(page, '儲存失敗')
    await expect(page.getByTestId('med-drug-error')).toBeVisible()
    await expect(page.getByTestId('med-dose-error')).toBeVisible()
  })

  test('UI-006.5 修改與刪除：刪除須輸入「刪除」確認', async ({ page, request }) => {
    const drug = uid('藥')
    drugs.push(drug)
    await request.post('/api/med', { data: { takenAt: minutesAgo(3), drug, dose: '1 顆', note: '' } })
    await page.goto('/med')
    await page.getByTestId('med-row').filter({ hasText: drug }).click()
    await expect(page.getByTestId('med-drawer')).toContainText('修改吃藥紀錄')
    await page.getByTestId('med-dose-input').fill('2 顆')
    await page.getByTestId('med-save-btn').click()
    await expectResult(page, '已儲存')
    await expect(page.getByTestId('med-row').filter({ hasText: drug })).toContainText('2 顆')
    await page.getByTestId('med-row').filter({ hasText: drug }).click()
    await page.getByTestId('med-delete-btn').click()
    await confirmDelete(page)
    await expectResult(page, '已刪除')
    await expect(page.getByTestId('med-row').filter({ hasText: drug })).toHaveCount(0)
  })

  test('UI-006.6 篩選不到資料時顯示空狀態', async ({ page }) => {
    await page.goto('/med')
    await page.getByTestId('med-period-custom').click()
    await page.getByTestId('med-from-input').fill('2020-01-01')
    await page.getByTestId('med-to-input').fill('2020-01-02')
    await expect(page.getByTestId('empty-state')).toContainText('這段期間沒有吃藥紀錄')
  })
})

test.describe('UI-006 吃藥頁 — 欄位資料來源驗證', { tag: '@UI-006' }, () => {
  test('UI-006.F1 列表的時間、藥名、劑量、備註與 API 值相同（來源：med_records）', async ({ page, request }) => {
    const drug = uid('藥')
    drugs.push(drug)
    const res = await request.post('/api/med', { data: { takenAt: minutesAgo(6), drug, dose: '1000 IU', note: 'e2e-field-verify-備註' } })
    const m = (await res.json()).data as Med
    await page.goto('/med')
    const row = page.getByTestId('med-row').filter({ hasText: drug })
    const hhmm = new Date(new Date(m.takenAt).getTime() + 8 * 3600_000).toISOString().slice(11, 16)
    for (const v of [hhmm, m.drug, m.dose, m.note]) await expect(row).toContainText(v)
  })
})
