"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { DEMO_ALLOWED_LINE_USER_ID, DEMO_STRANGER_LINE_USER_ID, login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  // 2026/11/12 - Arlen - 模擬 LINE 授權回來後的門禁判斷（F1）
  const handleLogin = (lineUserId: string) => {
    if (login(lineUserId)) router.replace("/");
    else router.replace("/denied");
  };

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
          onClick={() => handleLogin(DEMO_ALLOWED_LINE_USER_ID)}
          data-testid="login-line-btn"
          className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 font-semibold text-on-primary shadow-sm transition-all duration-[var(--duration-base)] hover:-translate-y-px hover:bg-primary-hover hover:shadow-md"
        >
          用 LINE 登入
        </button>

        <div className="mt-6 rounded-sm bg-muted p-4 text-sm">
          <p className="font-semibold text-fg">Demo 測試帳號</p>
          <p className="mt-1 text-fg-secondary">上方按鈕模擬 Arlen 本人的 LINE 帳號。</p>
          <button
            type="button"
            onClick={() => handleLogin(DEMO_STRANGER_LINE_USER_ID)}
            data-testid="login-stranger-btn"
            className="mt-3 min-h-11 w-full rounded-sm border border-neutral-300 bg-surface px-3 text-fg-secondary hover:bg-neutral-100 hover:text-fg"
          >
            模擬非本人帳號登入
          </button>
        </div>
      </div>
    </div>
  );
}
