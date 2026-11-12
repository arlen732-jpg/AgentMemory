// 對應驗收測試 UI-003 記憶列表與編輯抽屜（F4 人機介面）
import { test, expect } from '@playwright/test'
import { cleanup, deleteMemoriesByKey, uid } from './helpers/api'
import { confirmDelete, expectResult } from './helpers/ui'

type Memory = { id: string; item: string; key: string; summary: string; value: string; tags: string[]; updatedAt: string }
const keys: string[] = []
const ids = new Set<string>()
test.afterAll(async ({ request }) => {
  await deleteMemoriesByKey(request, keys)
  await cleanup(request, 'memories', ids)
})

test.describe('UI-003 記憶列表與編輯', { tag: '@UI-003' }, () => {
  test('UI-003.1 列表顯示筆數與 API 相同，每張卡片含名稱、摘要、分類', async ({ page, request }) => {
    const { data } = await (await request.get('/api/memories')).json()
    await page.goto('/memories')
    await expect(page.getByTestId('memories-count')).toHaveText(`共 ${data.length} 筆`)
    await expect(page.getByTestId('memory-item')).toHaveCount(data.length)
  })

  test('UI-003.2 搜尋關鍵字即時篩選；找不到時可清除篩選', async ({ page }) => {
    await page.goto('/memories')
    await page.getByTestId('memories-search-input').fill('上班時間')
    await expect(page.getByTestId('memory-item').filter({ hasText: '上班時間' }).first()).toBeVisible()
    await page.getByTestId('memories-search-input').fill(uid('none'))
    await expect(page.getByTestId('empty-state')).toContainText('找不到符合的記憶')
    await page.getByTestId('memories-clear-filter-btn').click()
    await expect(page.getByTestId('memories-search-input')).toHaveValue('')
    await expect(page.getByTestId('memory-item').first()).toBeVisible()
  })

  test('UI-003.3 依標籤篩選，只顯示含該標籤的記憶', async ({ page, request }) => {
    const { data } = await (await request.get('/api/memories')).json()
    const expected = (data as Memory[]).filter((m) => m.tags.includes('音樂')).length
    await page.goto('/memories')
    await page.getByTestId('memories-tag-select').selectOption('音樂')
    await expect(page.getByTestId('memory-item')).toHaveCount(expected)
  })

  test('UI-003.4 新增記憶：填寫後儲存，跳窗「已儲存」並出現在列表', async ({ page }) => {
    const key = uid('ui')
    keys.push(key)
    await page.goto('/memories')
    await page.getByTestId('memories-add-btn').click()
    const drawer = page.getByTestId('memory-drawer')
    await expect(drawer).toContainText('新增記憶')
    await page.getByTestId('memory-key-input').fill(key)
    await page.getByTestId('memory-summary-input').fill('UI 新增摘要')
    await page.getByTestId('memory-value-input').fill('UI 新增內容')
    await page.getByTestId('memory-tag-input').fill('ui標籤')
    await page.getByTestId('memory-tag-input').press('Enter')
    await expect(page.getByTestId('memory-tag-remove-btn')).toHaveCount(1)
    await page.getByTestId('memory-save-btn').click()
    await expectResult(page, '已儲存')
    await expect(drawer).toBeHidden()
    const card = page.getByTestId('memory-item').filter({ hasText: key })
    await expect(card).toContainText('UI 新增摘要')
    await expect(card).toContainText('ui標籤')
  })

  test('UI-003.5 必填未填：跳窗「儲存失敗」並以紅字標示欄位', async ({ page }) => {
    await page.goto('/memories')
    await page.getByTestId('memories-add-btn').click()
    await page.getByTestId('memory-save-btn').click()
    await expectResult(page, '儲存失敗')
    await expect(page.getByTestId('memory-key-error')).toBeVisible()
    await expect(page.getByTestId('memory-summary-error')).toBeVisible()
    await expect(page.getByTestId('memory-value-error')).toBeVisible()
  })

  test('UI-003.6 名稱為 index 或與既有同名時顯示紅字', async ({ page }) => {
    await page.goto('/memories')
    await page.getByTestId('memories-add-btn').click()
    await page.getByTestId('memory-key-input').fill('index')
    await page.getByTestId('memory-summary-input').fill('摘要')
    await page.getByTestId('memory-value-input').fill('內容')
    await page.getByTestId('memory-save-btn').click()
    await expectResult(page, '儲存失敗')
    await expect(page.getByTestId('memory-key-error')).toContainText('index')
    await page.getByTestId('memory-key-input').fill('上班時間')
    await page.getByTestId('memory-save-btn').click()
    await expectResult(page, '儲存失敗')
    await expect(page.getByTestId('memory-key-error')).toContainText('已有同名')
  })

  test('UI-003.7 修改記憶：抽屜帶入原值，儲存後列表更新', async ({ page, request }) => {
    const key = uid('ui')
    const res = await request.post('/api/memories', { data: { key, summary: '修改前', value: '修改前內容', tags: [] } })
    ids.add((await res.json()).data.id)
    await page.goto('/memories')
    await page.getByTestId('memory-item').filter({ hasText: key }).click()
    await expect(page.getByTestId('memory-drawer')).toContainText('修改記憶')
    await expect(page.getByTestId('memory-key-input')).toHaveValue(key)
    await expect(page.getByTestId('memory-summary-input')).toHaveValue('修改前')
    await page.getByTestId('memory-value-input').fill('修改後內容')
    await page.getByTestId('memory-save-btn').click()
    await expectResult(page, '已儲存')
    await expect(page.getByTestId('memory-item').filter({ hasText: key })).toContainText('修改後內容')
  })

  test('UI-003.8 刪除記憶：須輸入「刪除」才可確認，刪除後從列表消失', async ({ page, request }) => {
    const key = uid('ui')
    const res = await request.post('/api/memories', { data: { key, summary: '待刪除', value: '待刪除內容', tags: [] } })
    ids.add((await res.json()).data.id)
    await page.goto('/memories')
    await page.getByTestId('memory-item').filter({ hasText: key }).click()
    await page.getByTestId('memory-delete-btn').click()
    await expect(page.getByTestId('delete-confirm-dialog')).toContainText(key)
    await confirmDelete(page)
    await expectResult(page, '已刪除')
    await expect(page.getByTestId('memory-item').filter({ hasText: key })).toHaveCount(0)
  })

  test('UI-003.9 刪除確認按取消，資料保留', async ({ page, request }) => {
    const key = uid('ui')
    const res = await request.post('/api/memories', { data: { key, summary: '保留', value: '保留內容', tags: [] } })
    ids.add((await res.json()).data.id)
    await page.goto('/memories')
    await page.getByTestId('memory-item').filter({ hasText: key }).click()
    await page.getByTestId('memory-delete-btn').click()
    await page.getByTestId('delete-cancel-btn').click()
    await expect(page.getByTestId('delete-confirm-dialog')).toBeHidden()
    await page.getByTestId('memory-cancel-btn').click()
    await expect(page.getByTestId('memory-item').filter({ hasText: key })).toHaveCount(1)
  })
})

test.describe('UI-003 記憶列表 — 欄位資料來源驗證', { tag: '@UI-003' }, () => {
  test('UI-003.F1 卡片顯示的名稱、摘要、內容、分類、標籤與 API 值相同（來源：memories）', async ({ page, request }) => {
    const key = uid('ui')
    const res = await request.post('/api/memories', { data: { key, summary: '來源摘要', value: 'e2e-field-verify-內容', tags: ['來源標籤'] } })
    const m = (await res.json()).data as Memory
    ids.add(m.id)
    await page.goto('/memories')
    const card = page.getByTestId('memory-item').filter({ hasText: key })
    for (const v of [m.key, m.summary, m.value, m.item, ...m.tags]) await expect(card).toContainText(v)
  })

  test('UI-003.F2 列表卡片與編輯抽屜顯示同一筆資料（跨畫面一致）', async ({ page, request }) => {
    const key = uid('ui')
    const res = await request.post('/api/memories', { data: { key, summary: '一致性', value: '一致性內容', tags: [] } })
    ids.add((await res.json()).data.id)
    await page.goto('/memories')
    await page.getByTestId('memory-item').filter({ hasText: key }).click()
    await expect(page.getByTestId('memory-summary-input')).toHaveValue('一致性')
    await expect(page.getByTestId('memory-value-input')).toHaveValue('一致性內容')
    await expect(page.getByTestId('memory-item-select')).toHaveValue('個人')
  })
})
