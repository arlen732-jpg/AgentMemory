import type { Memory } from "@/lib/types";

// 2026/11/12 - Arlen - 前 4 筆取自 _Project/memory.json（補上摘要），後 6 筆為示意資料
export { MEMORY_DEFAULT_ITEM } from "@/lib/validation";

const rows: Omit<Memory, "id">[] = [
  { item: "個人", key: "上班時間", summary: "工作時段", value: "09:00 ~ 12:00、13:30 ~ 18:00", tags: ["作息"], updatedAt: "2026-07-06T10:51:46+08:00" },
  { item: "個人", key: "上班喜好音樂", summary: "音樂風格偏好", value: "無人聲，非高頻", tags: ["音樂"], updatedAt: "2026-07-06T15:26:37+08:00" },
  { item: "個人", key: "打開音樂方式", summary: "用 YouTube 搜尋頁", value: "喜歡用 https://www.youtube.com/results?search_query= 搜尋頁自己挑喜歡的，不喜歡直接指定單曲網址", tags: ["音樂"], updatedAt: "2026-07-06T10:54:10+08:00" },
  { item: "個人", key: "音樂搜尋關鍵字習慣", summary: "情境詞隨機", value: "每次開音樂搜尋時，在「無人聲、非高頻」基礎上，額外隨機加入情境詞（如：鋼琴、森林、雨聲、蟲鳴等），增加變化性", tags: ["音樂"], updatedAt: "2026-07-06T15:28:29+08:00" },
  { item: "個人", key: "午休習慣", summary: "午休時段與長度", value: "12:10 ~ 12:40 小睡 20 分鐘，鬧鐘設 12:35", tags: ["作息"], updatedAt: "2026-09-14T12:05:00+08:00" },
  { item: "個人", key: "咖啡偏好", summary: "咖啡種類與杯數", value: "無糖拿鐵，一天最多 2 杯，下午 3 點後不喝", tags: ["飲食"], updatedAt: "2026-10-02T09:20:00+08:00" },
  { item: "個人", key: "飲食禁忌", summary: "不吃的食物", value: "不吃香菜、內臟；少鹽（配合血壓控制）", tags: ["飲食", "健康"], updatedAt: "2026-10-20T19:40:00+08:00" },
  { item: "個人", key: "回覆語言", summary: "AI 回覆用語", value: "一律用繁體中文（台灣用語），技術名詞保留英文", tags: ["工作"], updatedAt: "2026-08-11T08:55:00+08:00" },
  { item: "個人", key: "會議時段偏好", summary: "可排會議的時間", value: "週二、週四下午 14:00 ~ 16:00；週一早上不排會", tags: ["工作", "作息"], updatedAt: "2026-09-30T17:10:00+08:00" },
  { item: "個人", key: "量血壓時間", summary: "每日量測時段", value: "起床後 30 分鐘內、吃早餐前量一次", tags: ["健康", "作息"], updatedAt: "2026-10-25T07:15:00+08:00" },
];

export function seedMemories(): Memory[] {
  return rows.map((r, i) => ({ ...r, id: `mem-${i + 1}` }));
}
