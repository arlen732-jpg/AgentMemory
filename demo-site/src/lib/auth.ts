// 2026/11/12 - Arlen - 模擬 LINE 登入。正式版改走 LINE OIDC + ALLOWED_LINE_USER_ID 比對
// DevGuidelines：前端儲存一律 sessionStorage

export const WEB_SESSION_HOURS = 12;
const SESSION_KEY = "am.session";

/** Demo 中「Arlen 本人」的 LINE 帳號代號（正式版來自 env） */
export const DEMO_ALLOWED_LINE_USER_ID = "U-demo-arlen";
export const DEMO_STRANGER_LINE_USER_ID = "U-demo-stranger";

type Session = { lineUserId: string; loggedInAt: number };

/** 模擬登入；不是 Arlen 時不建立登入狀態，回傳 false */
export function login(lineUserId: string): boolean {
  if (lineUserId !== DEMO_ALLOWED_LINE_USER_ID) return false;
  const s: Session = { lineUserId, loggedInAt: Date.now() };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  return true;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn(): boolean {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  try {
    const s = JSON.parse(raw) as Partial<Session>;
    if (s.lineUserId !== DEMO_ALLOWED_LINE_USER_ID || typeof s.loggedInAt !== "number") return false;
    // 時間點比對用 epoch 毫秒
    const expired = Date.now() - s.loggedInAt > WEB_SESSION_HOURS * 3600_000;
    if (expired) logout();
    return !expired;
  } catch {
    return false;
  }
}
