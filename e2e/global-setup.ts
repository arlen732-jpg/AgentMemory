// 2026/11/12 - Arlen - 全域前置：自行簽發 Auth.js session，存成 storageState 供 api / ui / e2e 共用
// 不走 LINE OAuth（無法自動化）；AUTH_SECRET、ALLOWED_LINE_USER_ID 只在記憶體使用，不輸出
import fs from 'node:fs'
import path from 'node:path'
import { STATE, mintSessionToken, sessionCookie } from './tests/helpers/auth'

export default async function globalSetup() {
  const token = await mintSessionToken()
  fs.mkdirSync(path.dirname(STATE.owner), { recursive: true })
  fs.writeFileSync(STATE.owner, JSON.stringify({ cookies: [sessionCookie(token)], origins: [] }, null, 2))
}
