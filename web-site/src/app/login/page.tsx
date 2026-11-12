"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  // 2026/11/12 - Arlen - 改走真 LINE OIDC（F1）；非本人由 auth.ts signIn callback 擋下並導到 /denied
  const handleLogin = () => signIn("line", { redirectTo: "/" });

  return (
    <div className="img-fallback relative flex min-h-screen items-center justify-center px-4">
      <Image src="/assets/login-bg.webp" alt="" fill priority className="object-cover" />
      <div className="relative w-full max-w-sm rounded-lg bg-surface/95 p-8 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col items-center text-center">
          <Image src="/assets/app-icon.png" alt="" width={64} height={64} />
          <h1 className="mt-4 text-2xl font-bold text-fg">個人記憶庫</h1>
          <p className="mt-2 text-sm text-fg-secondary">跨裝置共用的記憶，AI 助手和你都看得到</p>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          data-testid="login-line-btn"
          className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 font-semibold text-on-primary shadow-sm transition-all duration-[var(--duration-base)] hover:-translate-y-px hover:bg-primary-hover hover:shadow-md"
        >
          用 LINE 登入
        </button>

        <p className="mt-6 text-center text-xs text-fg-muted">只向 LINE 取得帳號代號，不取得 email 與好友名單。</p>
      </div>
    </div>
  );
}
