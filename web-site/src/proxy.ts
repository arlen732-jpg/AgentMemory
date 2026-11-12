// 2026/11/12 - Arlen - 頁面登入保護：未登入一律導到 /login
// API 由各 route 的 requireOwner() 自行檢查（回 401 JSON，不導頁）；/api/mcp 走 Bearer 通行碼
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    // 2026/11/12 - Arlen - OAuth 授權頁登入後要回到原頁（帶著 client_id 等參數）
    if (req.nextUrl.pathname.startsWith("/oauth/")) url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
});

export const config = {
  // 排除：API、登入／拒絕頁、OAuth 探索端點（.well-known）、Next 靜態資源、public 檔案
  // 2026/11/12 - Arlen - 加 .well-known：Claude 未登入也要讀得到 OAuth 設定
  matcher: ["/((?!api|login|denied|\\.well-known|_next/static|_next/image|assets|samples|favicon.ico).*)"],
};
