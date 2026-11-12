import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import { DialogProvider } from "@/components/dialogs";
import { Skeleton } from "@/components/ui";

// 2026/11/12 - Arlen - 登入保護改由 src/proxy.ts（Auth.js session）處理，移除前端 AuthGuard
// 2026/11/12 - Arlen - 頁面會讀「現在時間」算期間（台北時區），用 Suspense 讓內容在請求時渲染，不在 build 時預先算死
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <DialogProvider>
      <AppShell>
        <Suspense fallback={<Skeleton rows={6} />}>{children}</Suspense>
      </AppShell>
    </DialogProvider>
  );
}
