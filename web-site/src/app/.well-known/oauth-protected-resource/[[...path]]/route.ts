// 2026/11/12 - Arlen - 受保護資源設定（RFC 9728）：/api/mcp 回 401 時指向這裡
// 同時處理 /.well-known/oauth-protected-resource 與 /.well-known/oauth-protected-resource/api/mcp
import { getPublicOrigin, metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";

export function GET(req: Request) {
  return protectedResourceHandler({ authServerUrls: [getPublicOrigin(req)] })(req);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
