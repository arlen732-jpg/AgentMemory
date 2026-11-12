// 對應驗收測試 UI-004 匯入 memory.json（F6 人機介面）
import { test, expect, type Page } from '@playwright/test'
import { deleteMemoriesByKey, uid } from './helpers/api'
import { expectResult } from './helpers/ui'

const keys: string[] = []
test.afterAll(async ({ request }) => deleteMemoriesByKey(request, keys))

function upload(page: Page, content: unknown, name = 'memory.json', mimeType = 'application/json') {
  const text = typeof content === 'string' ? content : JSON.stringify(content)
  return page.getByTestId('import-file-input').setInputFiles({ name, mimeType, buffer: Buffer.from(text, 'utf8') })
}

test.describe('UI-004 匯入 memory.json', { tag: '@UI-004' }, () => {
  test('UI-004.1 頁面顯示選擇檔案與範例檔下載', async ({ page }) => {
    await page.goto('/memories/import', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('匯入 memory.json')
    await expect(page.getByTestId('import-choose-btn')).toBeVisible()
    await expect(page.getByTestId('import-sample-link')).toHaveAttribute('href', '/samples/memory-sample.json')
  })

  test('UI-004.2 非 .json 副檔名被拒絕', async ({ page }) => {
    await page.goto('/memories/import', { waitUntil: 'networkidle' })
    await upload(page, 'hello', 'memory.txt', 'text/plain')
    await expectResult(page, '檔案格式錯誤')
    await expect(page.getByTestId('import-row')).toHaveCount(0)
  })

  test('UI-004.3 格式不符時整份不匯入，並指出第幾筆', async ({ page }) => {
    await page.goto('/memories/import', { waitUntil: 'networkidle' })
    await upload(page, [{ key: 'a', value: 'v', tags: [], updatedAt: '2026-07-06T10:51:46+08:00' }, { key: 'b', tags: [], updatedAt: 'x' }])
    const dlg = page.getByTestId('submit-result-dialog')
    await expect(dlg).toContainText('整份不匯入')
    await expect(dlg).toContainText('第 2 筆')
    await page.getByTestId('submit-result-ok-btn').click()
    await expect(page.getByTestId('import-row')).toHaveCount(0)
  })

  test('UI-004.4 不是 JSON 或不是陣列時提示錯誤', async ({ page }) => {
    await page.goto('/memories/import', { waitUntil: 'networkidle' })
    await upload(page, '{not json')
    await expectResult(page, '整份不匯入')
    await upload(page, { key: 'a' })
    const dlg = page.getByTestId('submit-result-dialog')
    await expect(dlg).toContainText('陣列')
    await page.getByTestId('submit-result-ok-btn').click()
  })

  test('UI-004.5 預覽：摘要預設帶入內容前 30 字；重複名稱顯示覆蓋／略過（預設略過）', async ({ page }) => {
    const k = uid('imp')
    const long = '這是一段很長的內容'.repeat(5)
    await page.goto('/memories/import', { waitUntil: 'networkidle' })
    await upload(page, [
      { key: k, value: long, tags: ['匯入'], updatedAt: '2026-07-06T10:51:46+08:00' },
      { key: '上班時間', value: '不會覆蓋', tags: [], updatedAt: '2026-07-06T10:51:46+08:00' },
    ])
    await expect(page.getByTestId('import-row')).toHaveCount(2)
    const newRow = page.getByTestId('import-row').filter({ hasText: k })
    await expect(newRow.getByTestId('import-summary-input')).toHaveValue(long.slice(0, 30))
    const dup = page.getByTestId('import-row').filter({ hasText: '上班時間' })
    await expect(dup.getByTestId('import-conflict-group')).toBeVisible()
    await expect(dup.getByTestId('import-skip-radio')).toBeChecked()
    await expect(dup.getByTestId('import-summary-input')).toBeDisabled()
  })

  test('UI-004.6 摘要少於 2 字時無法匯入並提示', async ({ page }) => {
    const k = uid('imp')
    await page.goto('/memories/import', { waitUntil: 'networkidle' })
    await upload(page, [{ key: k, value: '內容', tags: [], updatedAt: '2026-07-06T10:51:46+08:00' }])
    await page.getByTestId('import-summary-input').fill('短')
    await page.getByTestId('import-confirm-btn').click()
    await expectResult(page, '匯入失敗')
  })

  test('UI-004.7 確認匯入：跳窗顯示新增／覆蓋／略過筆數並回到記憶列表', async ({ page }) => {
    const k1 = uid('imp')
    const k2 = uid('imp')
    keys.push(k1, k2)
    await page.goto('/memories/import', { waitUntil: 'networkidle' })
    await upload(page, [
      { key: k1, value: '匯入內容一', tags: ['匯入'], updatedAt: '2026-07-06T10:51:46+08:00' },
      { key: k2, value: '匯入內容二', tags: [], updatedAt: '2026-07-07T10:00:00+08:00' },
      { key: '上班時間', value: '不會覆蓋', tags: [], updatedAt: '2026-07-06T10:51:46+08:00' },
    ])
    await page.getByTestId('import-row').filter({ hasText: k1 }).getByTestId('import-summary-input').fill('匯入摘要一')
    await page.getByTestId('import-confirm-btn').click()
    const dlg = page.getByTestId('submit-result-dialog')
    await expect(dlg).toContainText('匯入完成')
    await expect(dlg).toContainText('新增 2 筆、覆蓋 0 筆，略過 1 筆')
    await page.getByTestId('submit-result-ok-btn').click()
    await expect(page).toHaveURL(/\/memories$/)
    const card = page.getByTestId('memory-item').filter({ hasText: k1 })
    await expect(card).toContainText('匯入摘要一')
    await expect(card).toContainText('個人')
    await expect(card).toContainText('2026/07/06 10:51')
  })

  test('UI-004.8 取消回到記憶列表', async ({ page }) => {
    await page.goto('/memories/import', { waitUntil: 'networkidle' })
    await upload(page, [{ key: uid('imp'), value: '內容', tags: [], updatedAt: '2026-07-06T10:51:46+08:00' }])
    await page.getByTestId('import-cancel-btn').click()
    await expect(page).toHaveURL(/\/memories$/)
  })
})
