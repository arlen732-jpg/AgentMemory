// 2026/11/12 - Arlen - 通行碼狀態模組（FSD §2.2）
// 狀態不存欄位，由 revokedAt、expiresAt 即時推導；過期與撤銷不可恢復

import type { ApiToken } from "./types";

export const TOKEN_DEFAULT_DAYS = 90;
export const TOKEN_MAX_DAYS = 365;

/** 值域集中定義（DevGuidelines：列舉值一律引用常數） */
export const TOKEN_STATUS = { ACTIVE: "active", EXPIRED: "expired", REVOKED: "revoked" } as const;
export type TokenStatus = (typeof TOKEN_STATUS)[keyof typeof TOKEN_STATUS];

export const TOKEN_STATUS_LABEL: Record<TokenStatus, string> = {
  active: "有效",
  expired: "已過期",
  revoked: "已撤銷",
};

/** 時間點比對用 epoch 毫秒；撤銷優先於過期 */
export function tokenStatus(t: ApiToken, now = Date.now()): TokenStatus {
  if (t.revokedAt) return TOKEN_STATUS.REVOKED;
  if (new Date(t.expiresAt).getTime() <= now) return TOKEN_STATUS.EXPIRED;
  return TOKEN_STATUS.ACTIVE;
}
