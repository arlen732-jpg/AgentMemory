// 2026/11/12 - Arlen - MCP 入口（F3）：Bearer 通行碼驗證，失敗一律回 401，不說明原因
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "@/server/mcp";
import { verifyBearer } from "@/server/tokens";

const handler = createMcpHandler(registerTools, { serverInfo: { name: "agentmemory", version: "1.0.0" } });

const authed = withMcpAuth(
  handler,
  async (_req, bearer) => {
    if (!bearer) return undefined;
    const id = await verifyBearer(bearer);
    return id ? { token: bearer, clientId: id, scopes: [] } : undefined;
  },
  // 2026/11/12 - Arlen - 401 附 resource_metadata，讓 Claude 自訂連接器走 OAuth
  { required: true, resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp" },
);

export { authed as GET, authed as POST };
