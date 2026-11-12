// 對應驗收測試 FR-03 AI 入口通行碼驗證（F3／REQ-SYS-003）
// /api/mcp 走 Bearer 通行碼（withMcpAuth required），失敗一律 401、不說明原因
import { test, expect } from '@playwright/test'
import { expectOk, revokeAll } from './helpers/api'
import { McpClient, TOOL_NAMES, createMcpToken, parseRpc, rpcPost } from './helpers/mcp'

type Token = { id: string; lastUsedAt: string | null }

test.describe('FR-03 AI 入口通行碼驗證', { tag: '@FR-03' }, () => {
  test.describe.configure({ mode: 'serial' })
  let tok: { id: string; secret: string }

  test.beforeAll(async ({ request }) => {
    tok = await createMcpToken(request)
  })
  test.afterAll(async ({ request }) => {
    await revokeAll(request, [tok.id])
  })

  test('3.1 未帶通行碼呼叫 MCP 回 401', async ({ request }) => {
    const res = await rpcPost(request, null, 'tools/list')
    expect(res.status()).toBe(401)
    expect(res.headers()['www-authenticate']).toContain('Bearer')
  })

  test('3.2 帶錯誤的 am_ 通行碼回 401', async ({ request }) => {
    const res = await rpcPost(request, 'am_this_is_not_a_valid_token_000000', 'tools/list')
    expect(res.status()).toBe(401)
  })

  test('3.3 帶非 am_ 前綴的字串回 401', async ({ request }) => {
    const res = await rpcPost(request, 'Bearer-garbage', 'tools/list')
    expect(res.status()).toBe(401)
  })

  test('3.4 有效通行碼可 initialize，伺服器名稱為 agentmemory', async ({ request }) => {
    const msg = await new McpClient(request, tok.secret).initialize()
    expect(msg.result.serverInfo.name).toBe('agentmemory')
  })

  test('3.5 tools/list 列出 10 個工具', async ({ request }) => {
    const tools = await new McpClient(request, tok.secret).listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort())
  })

  test('3.6 驗證通過後更新通行碼的最後使用時間', async ({ request }) => {
    const before = Date.now()
    await new McpClient(request, tok.secret).listTools()
    const rows = await expectOk<Token[]>(await request.get('/api/tokens'))
    const t = rows.find((r) => r.id === tok.id)
    expect(t?.lastUsedAt).not.toBeNull()
    expect(new Date(t!.lastUsedAt!).getTime()).toBeGreaterThanOrEqual(before - 5_000)
  })

  test('3.7 已撤銷的通行碼立即回 401，且回應與錯誤通行碼相同（不透露原因）', async ({ request }) => {
    await expectOk(await request.post(`/api/tokens/${tok.id}/revoke`))
    const revoked = await rpcPost(request, tok.secret, 'tools/list')
    expect(revoked.status()).toBe(401)
    const wrong = await rpcPost(request, 'am_this_is_not_a_valid_token_000000', 'tools/list')
    expect(wrong.status()).toBe(401)
    expect(await revoked.text()).toBe(await wrong.text())
  })
})

test.describe('FR-03 RBAC 拒絕測試', { tag: '@FR-03' }, () => {
  test('3.R1 只有網頁 session（無 Bearer）不能進 MCP，回 401', async ({ request }) => {
    // request 已帶本人 session cookie，但 MCP 只認通行碼
    const res = await rpcPost(request, null, 'initialize', {})
    expect(res.status()).toBe(401)
  })

  test('3.R4 有效通行碼呼叫工具回 200 且有結果', async ({ request }) => {
    const tok = await createMcpToken(request)
    try {
      const res = await rpcPost(request, tok.secret, 'tools/call', { name: 'med_drugs', arguments: {} })
      expect(res.status()).toBe(200)
      const msg = await parseRpc(res)
      expect(msg.result.isError ?? false).toBe(false)
      expect(Array.isArray(JSON.parse(msg.result.content[0].text))).toBe(true)
    } finally {
      await revokeAll(request, [tok.id])
    }
  })
})
