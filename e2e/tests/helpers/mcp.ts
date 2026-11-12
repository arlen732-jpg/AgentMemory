// 2026/11/12 - Arlen - MCP Streamable HTTP（JSON-RPC）測試客戶端
// 通行碼一律經網頁 API（帶 session）產生，測試結束撤銷
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test'
import { dateAfter, uid } from './api'

export const MCP_PATH = '/api/mcp'
export const PROTOCOL_VERSION = '2025-06-18'

export const TOOL_NAMES = [
  'memory_get', 'memory_search', 'memory_save', 'memory_delete',
  'bp_add', 'bp_query', 'bp_summary',
  'med_add', 'med_query', 'med_drugs',
]

/** 經網頁 API 產生通行碼，回傳 id 與原文 */
export async function createMcpToken(request: APIRequestContext, name = uid('mcp')) {
  const res = await request.post('/api/tokens', { data: { name, expires: dateAfter(2) } })
  expect(res.status(), await res.text()).toBe(201)
  const { data } = await res.json()
  return { id: data.token.id as string, secret: data.secret as string, name }
}

/** 回應可能是 JSON 或 SSE（event: message / data: {...}），兩種都解析 */
export async function parseRpc(res: APIResponse): Promise<any> {
  const raw = await res.text()
  const ct = res.headers()['content-type'] ?? ''
  if (ct.includes('text/event-stream') || raw.startsWith('event:') || raw.startsWith('data:')) {
    const lines = raw.split(/\r?\n/).filter((l) => l.startsWith('data:'))
    const msgs = lines.map((l) => JSON.parse(l.slice(5).trim()))
    return msgs.find((m) => m && ('result' in m || 'error' in m)) ?? msgs[0]
  }
  return JSON.parse(raw)
}

let seq = 1

export function rpcPost(request: APIRequestContext, bearer: string | null, method: string, params: unknown = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'mcp-protocol-version': PROTOCOL_VERSION,
  }
  if (bearer !== null) headers.Authorization = `Bearer ${bearer}`
  return request.post(MCP_PATH, { headers, data: { jsonrpc: '2.0', id: seq++, method, params } })
}

export type ToolResult = { text: string; isError: boolean; rpcError?: { code: number; message: string } }

export class McpClient {
  constructor(private request: APIRequestContext, private bearer: string) {}

  async initialize() {
    const res = await rpcPost(this.request, this.bearer, 'initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'e2e', version: '1.0.0' },
    })
    expect(res.status(), await res.text()).toBe(200)
    return parseRpc(res)
  }

  async listTools(): Promise<{ name: string }[]> {
    const res = await rpcPost(this.request, this.bearer, 'tools/list')
    expect(res.status()).toBe(200)
    const msg = await parseRpc(res)
    return msg.result.tools
  }

  /** 呼叫工具；參數驗證失敗可能回 isError 結果或 JSON-RPC error，兩者都視為「拒絕」 */
  async call(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    const res = await rpcPost(this.request, this.bearer, 'tools/call', { name, arguments: args })
    expect(res.status()).toBe(200)
    const msg = await parseRpc(res)
    if (msg.error) return { text: String(msg.error.message ?? ''), isError: true, rpcError: msg.error }
    const text = (msg.result.content ?? []).map((c: { text?: string }) => c.text ?? '').join('\n')
    return { text, isError: !!msg.result.isError }
  }

  /** 呼叫工具並把成功的 JSON 文字解析回物件 */
  async callJson<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const r = await this.call(name, args)
    expect(r.isError, r.text).toBe(false)
    return JSON.parse(r.text) as T
  }
}
