// 2026/11/12 - Arlen - 日期時間工具
// DevGuidelines：顯示 yyyy/MM/dd；業務時區 Asia/Taipei 固定 +8（無日光節約），不依賴執行環境時區

const TZ_OFFSET_MS = 8 * 3600_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** 把時間點轉成「台北牆上時間」的各欄位 */
function taipeiParts(iso: string | number | Date) {
  const t = new Date(new Date(iso).getTime() + TZ_OFFSET_MS);
  return {
    y: t.getUTCFullYear(), M: t.getUTCMonth() + 1, d: t.getUTCDate(),
    h: t.getUTCHours(), m: t.getUTCMinutes(),
  };
}

/** yyyy/MM/dd */
export function fmtDate(iso: string | number | Date) {
  const p = taipeiParts(iso);
  return `${p.y}/${pad(p.M)}/${pad(p.d)}`;
}

/** yyyy/MM/dd HH:mm */
export function fmtDateTime(iso: string | number | Date) {
  const p = taipeiParts(iso);
  return `${fmtDate(iso)} ${pad(p.h)}:${pad(p.m)}`;
}

/** MM/dd（圖表橫軸用） */
export function fmtShortDate(iso: string | number | Date) {
  const p = taipeiParts(iso);
  return `${pad(p.M)}/${pad(p.d)}`;
}

/** 台北時間的 yyyy-MM-ddTHH:mm，給 <input type="datetime-local"> */
export function toLocalInput(iso: string | number | Date) {
  const p = taipeiParts(iso);
  return `${p.y}-${pad(p.M)}-${pad(p.d)}T${pad(p.h)}:${pad(p.m)}`;
}

/** <input type="datetime-local"> 的值一律當台北時間解讀，轉成帶時區 ISO */
export function fromLocalInput(v: string) {
  return new Date(`${v}:00+08:00`).toISOString();
}

/** 台北時間的 yyyy-MM-dd，給 <input type="date"> */
export function toDateInput(iso: string | number | Date) {
  const p = taipeiParts(iso);
  return `${p.y}-${pad(p.M)}-${pad(p.d)}`;
}

/** 台北時間某日 23:59:59 的時間點 */
export function endOfTaipeiDay(dateInput: string) {
  return new Date(`${dateInput}T23:59:59+08:00`).toISOString();
}

/** 台北時間今天 00:00 往前推 days-1 天的起點（含今天共 days 天） */
export function startOfTaipeiDaysAgo(days: number) {
  const today = toDateInput(Date.now());
  const start = new Date(`${today}T00:00:00+08:00`).getTime() - (days - 1) * 86400_000;
  return new Date(start).toISOString();
}

export function isFuture(iso: string) {
  return new Date(iso).getTime() > Date.now();
}
