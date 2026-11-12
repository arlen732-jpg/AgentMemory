// 2026/11/12 - Arlen - 讀取 web-site/.env.local（只取測試需要的值；不得輸出或記錄任何值）
import path from 'node:path'
import { config } from 'dotenv'

let loaded = false

export function loadEnv() {
  if (!loaded) {
    // 2026/11/12 - Arlen - e2e 移到專案根目錄，改指向 web-site/.env.local
    config({ path: path.resolve(__dirname, '../../../web-site/.env.local'), quiet: true })
    loaded = true
  }
}

/** 取必要環境變數；缺少時只回報變數名稱，不印出值 */
export function requireEnv(name: string): string {
  loadEnv()
  const v = process.env[name]
  if (!v) throw new Error(`web-site/.env.local 缺少 ${name}`)
  return v
}

/** 正整數參數；不合法時退回預設（與 server/tokens.ts envDays 規則相同） */
export function envInt(name: string, fallback: number): number {
  loadEnv()
  const n = Number(process.env[name])
  return Number.isInteger(n) && n > 0 ? n : fallback
}
