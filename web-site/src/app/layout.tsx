import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentMemory 個人記憶庫",
  description: "跨裝置共用的個人記憶庫（Demo）",
  icons: { icon: "/assets/favicon.ico", apple: "/assets/app-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
