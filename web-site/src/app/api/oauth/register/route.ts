// 2026/11/12 - Arlen - OAuth 動態註冊（RFC 7591）：回呼網址只接受 Claude 官方網址
import { OAuthError, oauthFail, oauthJson, registerClient } from "@/server/oauth";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new OAuthError("invalid_client_metadata", "送出的資料格式不正確。");
    }
    if (typeof body !== "object" || body === null || Array.isArray(body))
      throw new OAuthError("invalid_client_metadata", "送出的資料格式不正確。");
    return oauthJson(await registerClient(body as Record<string, unknown>), 201);
  } catch (e) {
    return oauthFail(e);
  }
}
