// 2026/11/12 - Arlen - 網頁登入（F1）：Auth.js v5 + LINE OIDC
// - scope 只要 openid profile，不要 email（FSD F1：只向 LINE 要求帳號代號）
// - 只有 ALLOWED_LINE_USER_ID 可登入；成功與失敗都寫 login_logs
// - JWT session，維持 WEB_SESSION_HOURS 小時，不建 adapter 資料表
import NextAuth from "next-auth";
import LINE from "next-auth/providers/line";
import { loginLogs } from "@/db/schema";
import { db } from "@/server/db";

const sessionHours = Number(process.env.WEB_SESSION_HOURS) || 12;

async function logLogin(lineUserId: string, success: boolean) {
  try {
    await db().insert(loginLogs).values({ lineUserId: lineUserId.slice(0, 64), success });
  } catch (e) {
    // 紀錄失敗不擋登入判斷
    console.error("[auth] login_logs", e instanceof Error ? e.message : e);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [LINE({ authorization: { params: { scope: "openid profile" } } })],
  session: { strategy: "jwt", maxAge: sessionHours * 3600 },
  pages: { signIn: "/login", error: "/denied" },
  callbacks: {
    async signIn({ account }) {
      const lineUserId = account?.providerAccountId ?? "";
      const allowed = !!lineUserId && lineUserId === process.env.ALLOWED_LINE_USER_ID;
      await logLogin(lineUserId || "(unknown)", allowed);
      return allowed;
    },
    // session 只留顯示名稱，不放 email、頭像
    session({ session, token }) {
      session.user = { ...session.user, name: token.name ?? "Arlen", email: "", image: null };
      return session;
    },
  },
});
