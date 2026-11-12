// 2026/11/12 - Arlen - OAuth 授權送出：重新檢查登入與參數，再導回 Claude 回呼網址
import { auth } from "@/auth";
import { callbackUrl, checkAuthorize, issueCode, oauthFail, OAuthError } from "@/server/oauth";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) throw new OAuthError("access_denied", "登入已逾時，請回到 Claude 重新連接。", 401);

    const form = await req.formData();
    const p = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
    const { req: r, redirectError } = await checkAuthorize(p);

    let target: string;
    if (redirectError) target = callbackUrl(r.redirectUri, { error: redirectError }, r.state);
    else if (p.decision !== "allow") target = callbackUrl(r.redirectUri, { error: "access_denied" }, r.state);
    else target = callbackUrl(r.redirectUri, { code: await issueCode(r) }, r.state);

    return new Response(null, { status: 303, headers: { Location: target, "Cache-Control": "no-store" } });
  } catch (e) {
    return oauthFail(e);
  }
}
