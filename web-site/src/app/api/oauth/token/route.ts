// 2026/11/12 - Arlen - OAuth 權杖端點：授權碼 + PKCE 換 am_ 通行碼（不發刷新權杖）
import { exchangeCode, oauthFail, oauthJson } from "@/server/oauth";

export async function POST(req: Request) {
  try {
    // 標準格式是 application/x-www-form-urlencoded；也接受 JSON
    const type = req.headers.get("content-type") ?? "";
    let p: Record<string, string> = {};
    if (type.includes("application/json")) {
      const body = await req.json().catch(() => null);
      if (body && typeof body === "object" && !Array.isArray(body))
        p = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v ?? "")]));
    } else {
      p = Object.fromEntries(new URLSearchParams(await req.text()));
    }
    return oauthJson(await exchangeCode(p));
  } catch (e) {
    return oauthFail(e);
  }
}
