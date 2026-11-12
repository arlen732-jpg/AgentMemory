// 2026/11/12 - Arlen - OAuth 授權頁：proxy 已確保登入；按「允許」才發授權碼
import { CircleAlert, KeyRound } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui";
import { callbackUrl, checkAuthorize, OAuthError } from "@/server/oauth";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// cacheComponents 下讀 searchParams 屬動態資料，必須包在 Suspense 內
export default function AuthorizePage({ searchParams }: Props) {
  return (
    <Suspense fallback={null}>
      <Consent searchParams={searchParams} />
    </Suspense>
  );
}

async function Consent({ searchParams }: Props) {
  const raw = await searchParams;
  const p = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));

  let checked: Awaited<ReturnType<typeof checkAuthorize>>;
  try {
    checked = await checkAuthorize(p);
  } catch (e) {
    const message = e instanceof OAuthError ? e.description : "系統發生錯誤，請稍後再試。";
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg bg-surface p-8 text-center shadow-md" data-testid="oauth-error-panel">
          <CircleAlert className="mx-auto text-danger" size={40} strokeWidth={1.75} aria-hidden />
          <h1 className="mt-4 text-xl font-bold text-fg">無法授權</h1>
          <p className="mt-2 text-sm text-fg-secondary">{message}</p>
        </div>
      </div>
    );
  }

  const { req, redirectError } = checked;
  if (redirectError) redirect(callbackUrl(req.redirectUri, { error: redirectError }, req.state));

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form method="post" action="/api/oauth/authorize" className="w-full max-w-sm rounded-lg bg-surface p-8 shadow-md" data-testid="oauth-consent-form">
        <div className="text-center">
          <KeyRound className="mx-auto text-primary" size={40} strokeWidth={1.75} aria-hidden />
          <h1 className="mt-4 text-xl font-bold text-fg">允許「{req.clientName}」存取個人記憶庫？</h1>
          <p className="mt-2 text-sm text-fg-secondary">
            允許後，對方可以讀寫你的記憶、血壓與吃藥紀錄。之後可在「通行碼」頁撤銷。
          </p>
        </div>
        <input type="hidden" name="client_id" value={req.clientId} />
        <input type="hidden" name="redirect_uri" value={req.redirectUri} />
        <input type="hidden" name="state" value={req.state} />
        <input type="hidden" name="code_challenge" value={req.codeChallenge} />
        <input type="hidden" name="code_challenge_method" value="S256" />
        <input type="hidden" name="response_type" value="code" />
        <div className="mt-8 flex gap-3">
          <Button type="submit" name="decision" value="deny" variant="secondary" data-testid="oauth-deny-btn" className="flex-1">
            拒絕
          </Button>
          <Button type="submit" name="decision" value="allow" data-testid="oauth-allow-btn" className="flex-1">
            允許
          </Button>
        </div>
      </form>
    </div>
  );
}
