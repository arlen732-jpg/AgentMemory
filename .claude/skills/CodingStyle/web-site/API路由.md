# web-site API 路由

**涵蓋範圍**：`src/app/api/**` 底下給網頁使用的 Route Handler。MCP 入口另外處理，見 `/api/mcp`。

## 路徑與 Method

DevGuidelines 規定禁用 PUT 和 DELETE，所以修改、刪除都用 POST，動作寫在路徑上。

| 動作 | Method | 路徑 |
|---|---|---|
| 列表 | GET | `/api/{功能}?篩選參數` |
| 新增 | POST | `/api/{功能}` |
| 修改 | POST | `/api/{功能}/{id}/update` |
| 刪除 | POST | `/api/{功能}/{id}/delete` |
| 其他動作 | POST | `/api/{功能}/{id}/{動作}`，例：`/api/tokens/{id}/revoke` |

## 範本

**為什麼這樣寫**：每支 route 只有三件事，第一行一定是 `requireOwner()`，不可以只靠前端隱藏按鈕。用 `route()` 包起來，錯誤格式就會統一。

```ts
// 2026/11/12 - Arlen - 記憶修改（F4）；DevGuidelines 禁用 PUT，一律 POST
import { updateMemory } from "@/server/memories";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";
import type { MemoryInput } from "@/lib/validation";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  return ok(await updateMemory(id, await readJson<Partial<MemoryInput>>(req)));
});
```

⚠️ 注意：`params` 是 Promise，要 `await` 才能取值。不要用 `RouteContext<"...">`：它要靠 Next typegen 產生，單跑 `tsc` 會找不到型別。

## 回應格式

```json
{ "ok": true, "data": { … } }
{ "ok": false, "error": { "code": "validation", "message": "…", "fields": { "key": "分類「個人」已有同名記憶" } } }
```

| code | HTTP 狀態碼 | 什麼時候用 |
|---|---|---|
| `unauthorized` | 401 | 未登入。前端收到後導回 `/login` |
| `validation` | 400 | 欄位錯誤，放在 `fields` |
| `bad_request` | 400 | body 不是合法的 JSON |
| `not_found` | 404 | 指定的 id 不存在 |
| `conflict` | 409 | 狀態不允許，例：撤銷已撤銷的通行碼 |
| `server_error` | 500 | 未預期的錯誤 |

## 前端呼叫

頁面透過 `useCollection(name, query)` 讀資料，寫入時 `await api.add / update / remove`。失敗時：

1. 如果是 `ClientApiError`，把 `err.fields` 交給 `setErrors`，顯示紅字。
2. 一律用 `dialog.notify({ ok: false, message: errorMessage(err) })` 跳窗。

```tsx
try {
  if (memory) await api.update(memory.id, row);
  else await api.add(row);
} catch (err) {
  if (err instanceof ClientApiError) setErrors(err.fields as Errors<keyof MemoryInput>);
  await dialog.notify({ ok: false, title: "儲存失敗", message: errorMessage(err) });
  return;
}
```

## neon-http 的限制

neon-http 不支援互動式交易（`db.transaction`）。需要整批寫入時，先算好所有語句，再用 `db().batch([...])` 一次送出。

---
## 分析檔案清單

> 本次分析日期：2026/11/12

| # | 檔案路徑 | 分類 |
|---|---------|------|
| 1 | src/app/api/memories/route.ts | API/路由 |
| 2 | src/app/api/memories/[id]/update/route.ts | API/路由 |
| 3 | src/app/api/memories/[id]/delete/route.ts | API/路由 |
| 4 | src/app/api/auth/[...nextauth]/route.ts | API/路由 |
| 5 | src/components/memories/MemoryDrawer.tsx | 表單 |
