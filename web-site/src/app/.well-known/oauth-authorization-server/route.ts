// 2026/11/12 - Arlen - OAuth 授權伺服器設定（RFC 8414），供 Claude 自訂連接器探索端點
import { getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { authServerMetadata } from "@/server/oauth";

export function GET(req: Request) {
  return Response.json(authServerMetadata(getPublicOrigin(req)), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "max-age=3600" },
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
