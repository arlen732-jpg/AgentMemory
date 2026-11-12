"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { isLoggedIn } from "@/lib/auth";

const noopSubscribe = () => () => {};

/** 未登入或登入逾時就導回登入頁；SSR 時回傳 null，先顯示空白 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ok = useSyncExternalStore(noopSubscribe, isLoggedIn, () => null);

  useEffect(() => {
    if (ok === false) router.replace("/login");
  }, [ok, router]);

  // 2026/11/12 - Arlen - 未登入時仍要渲染頁面區段（只隱藏），否則 Next.js instant navigation 驗證會報「segment dropped」 - Start
  return (
    <>
      {!ok && <div className="min-h-screen" aria-busy="true" />}
      <div hidden={!ok}>{children}</div>
    </>
  );
  // 2026/11/12 - Arlen - 未登入時仍要渲染頁面區段 - end
}
