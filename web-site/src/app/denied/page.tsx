import Link from "next/link";
import { CircleAlert } from "lucide-react";

// F1：只說無權使用，不透露任何其他資訊
export default function DeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg bg-surface p-8 text-center shadow-md" data-testid="denied-panel">
        <CircleAlert className="mx-auto text-danger" size={40} strokeWidth={1.75} aria-hidden />
        <h1 className="mt-4 text-xl font-bold text-fg">此帳號無權使用本系統</h1>
        <Link href="/login" data-testid="denied-back-link" className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-primary-text underline-offset-4 hover:underline">
          回到登入頁
        </Link>
      </div>
    </div>
  );
}
