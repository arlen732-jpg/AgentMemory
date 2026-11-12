import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center" data-testid="not-found-panel">
        <div className="img-fallback mx-auto h-50 w-50 rounded-lg">
          <Image src="/assets/not-found.png" alt="" width={200} height={200} priority />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-fg">找不到這一頁</h1>
        <p className="mt-2 text-sm text-fg-secondary">網址可能打錯了，或這一頁已經移除。</p>
        <Link href="/" data-testid="not-found-home-link"
          className="mt-6 inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-medium text-on-primary shadow-sm hover:bg-primary-hover">
          回到首頁
        </Link>
      </div>
    </div>
  );
}
