// 2026/11/12 - Arlen - AgentMemory 驗收測試設定（GenAcceptanceTest，模式 B／深度 L4）
// 受測服務：web-site（Next.js 全端同源），api / ui / e2e 共用同一個 baseURL
import { defineConfig, devices } from '@playwright/test'
import { STATE } from './tests/helpers/auth'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  },
  projects: [
    // API：預設帶已簽發的 session cookie；未登入案例在 spec 內改用空白 context
    { name: 'api', testMatch: /.*\.api\.spec\.ts/, use: { baseURL: BASE, storageState: STATE.owner } },
    { name: 'ui', testMatch: /.*\.ui\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: BASE, storageState: STATE.owner } },
    // L4 端到端情境：不設全域 storageState，由各 test 自行 newContext
    { name: 'e2e', testMatch: /.*\.e2e\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: BASE } },
  ],
  globalSetup: './global-setup.ts',
})
