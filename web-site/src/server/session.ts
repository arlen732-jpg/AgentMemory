// 2026/11/12 - Arlen - 網頁 API 的登入檢查：不能只靠前端隱藏（OWASP）
import "server-only";
import { auth } from "@/auth";
import { ApiError, ERROR_CODE } from "./http";

export async function requireOwner() {
  const session = await auth();
  if (!session?.user) throw new ApiError(ERROR_CODE.UNAUTHORIZED, "登入已逾時，請重新登入。");
  return session;
}
