// 2026/11/12 - Arlen - 資料模型，對應 FSD §6.3 資料表

/** 記憶（memories） */
export type Memory = {
  id: string;
  item: string;      // 分類，必須是 memory_items 內的名稱
  key: string;       // 名稱，同分類內唯一；index 為保留字
  summary: string;   // 摘要，30 字內
  value: string;     // 內容
  tags: string[];
  updatedAt: string; // ISO-8601（含時區）
};

/** 血壓（bp_records） */
export type BpRecord = {
  id: string;
  measuredAt: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  note: string;      // 正式版 AES-256-GCM 加密
};

/** 吃藥（med_records） */
export type MedRecord = {
  id: string;
  takenAt: string;
  drug: string;
  dose: string;
  note: string;      // 正式版 AES-256-GCM 加密
};

/** 通行碼（api_tokens）：只存指紋，Demo 以 tokenPreview 代表末 4 碼 */
export type ApiToken = {
  id: string;
  name: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  tokenPreview: string;
};

// 2026/11/12 - Arlen - 分類維護（memory_items）；memoryCount 由後端即時計算
export type MemoryItem = {
  id: string;
  name: string;
  memoryCount: number;
  createdAt: string;
};

// 2026/11/12 - Arlen - 吃藥按鈕設定（med_buttons + med_button_items）
export type MedButtonDrug = { drug: string; dose: string };
export type MedButton = {
  id: string;
  name: string;
  sort: number;
  drugs: MedButtonDrug[];
  createdAt: string;
};

export type Collections = {
  memories: Memory;
  items: MemoryItem;
  medButtons: MedButton; // 2026/11/12 - Arlen - 吃藥按鈕設定
  bp: BpRecord;
  med: MedRecord;
  tokens: ApiToken;
};
export type CollectionName = keyof Collections;
