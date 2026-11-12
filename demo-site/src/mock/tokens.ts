import type { ApiToken } from "@/lib/types";

// 2026/11/12 - Arlen - 通行碼示意：有效 2、已過期 1、已撤銷 1（日期以今天往回推）

const daysFromNow = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();

export function seedTokens(): ApiToken[] {
  return [
    { id: "tk-1", name: "公司電腦", createdAt: daysFromNow(-40), expiresAt: daysFromNow(50), lastUsedAt: daysFromNow(-0.1), revokedAt: null, tokenPreview: "x7Qa" },
    { id: "tk-2", name: "家裡電腦", createdAt: daysFromNow(-20), expiresAt: daysFromNow(70), lastUsedAt: daysFromNow(-1.4), revokedAt: null, tokenPreview: "Lm3p" },
    { id: "tk-3", name: "舊筆電", createdAt: daysFromNow(-120), expiresAt: daysFromNow(-30), lastUsedAt: daysFromNow(-35), revokedAt: null, tokenPreview: "9dKe" },
    { id: "tk-4", name: "出差平板", createdAt: daysFromNow(-60), expiresAt: daysFromNow(30), lastUsedAt: daysFromNow(-25), revokedAt: daysFromNow(-22), tokenPreview: "Tz0w" },
  ];
}
