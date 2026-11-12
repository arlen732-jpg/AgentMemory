// 2026/11/12 - Arlen - UI 共用操作：送件結果跳窗、刪除確認（須輸入「刪除」）、一般確認
import { expect, type Page } from '@playwright/test'

/** 等結果跳窗出現，斷言標題後按「確定」關閉 */
export async function expectResult(page: Page, title: string | RegExp) {
  const dlg = page.getByTestId('submit-result-dialog')
  await expect(dlg).toBeVisible()
  await expect(dlg).toContainText(title)
  await page.getByTestId('submit-result-ok-btn').click()
  await expect(dlg).toBeHidden()
}

/** 刪除確認：未輸入前刪除鍵停用，輸入「刪除」後才可按 */
export async function confirmDelete(page: Page) {
  const dlg = page.getByTestId('delete-confirm-dialog')
  await expect(dlg).toBeVisible()
  await expect(page.getByTestId('delete-confirm-btn')).toBeDisabled()
  await page.getByTestId('delete-confirm-input').fill('刪除')
  await expect(page.getByTestId('delete-confirm-btn')).toBeEnabled()
  await page.getByTestId('delete-confirm-btn').click()
}

/** datetime-local 值（台北時間）：n 分鐘前 */
export function localInputMinutesAgo(n: number) {
  const t = new Date(Date.now() - n * 60_000 + 8 * 3600_000)
  return t.toISOString().slice(0, 16)
}
