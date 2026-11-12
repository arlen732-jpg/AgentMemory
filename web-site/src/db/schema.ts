// 2026/11/12 - Arlen - 資料表定義（GenWebSite-Analysis §3；FSD §6.3）
// 長度與 lib/validation.ts 的 LIMITS 對齊；改長度時兩處一起改

import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, smallint, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

const tz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => tz("created_at").notNull().defaultNow();
const updatedAt = () => tz("updated_at").notNull().defaultNow();

/** 個人記憶：同分類內名稱唯一 */
export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    item: varchar("item", { length: 20 }).notNull().default("個人"),
    key: varchar("key", { length: 50 }).notNull(),
    summary: varchar("summary", { length: 30 }).notNull(),
    value: varchar("value", { length: 2000 }).notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("memories_item_key_uq").on(t.item, t.key),
    index("memories_tags_gin").using("gin", t.tags),
    check("memories_key_not_index", sql`lower(${t.key}) <> 'index'`),
  ],
);

/** 通行碼：只存 SHA-256 指紋；狀態由 revoked_at、expires_at 推導 */
export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 30 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  tokenPreview: varchar("token_preview", { length: 4 }).notNull(),
  expiresAt: tz("expires_at").notNull(),
  lastUsedAt: tz("last_used_at"),
  revokedAt: tz("revoked_at"),
  createdAt: createdAt(),
});

/** 血壓：note 存 AES-256-GCM 密文 */
export const bpRecords = pgTable(
  "bp_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    measuredAt: tz("measured_at").notNull(),
    systolic: smallint("systolic").notNull(),
    diastolic: smallint("diastolic").notNull(),
    pulse: smallint("pulse"),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bp_measured_at_idx").on(t.measuredAt),
    check("bp_systolic_range", sql`${t.systolic} between 50 and 300`),
    check("bp_diastolic_range", sql`${t.diastolic} between 30 and 200`),
    check("bp_pulse_range", sql`${t.pulse} is null or ${t.pulse} between 30 and 250`),
    check("bp_sys_gt_dia", sql`${t.systolic} > ${t.diastolic}`),
  ],
);

/** 吃藥：note 存 AES-256-GCM 密文 */
export const medRecords = pgTable(
  "med_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    takenAt: tz("taken_at").notNull(),
    drug: varchar("drug", { length: 50 }).notNull(),
    dose: varchar("dose", { length: 30 }).notNull(),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("med_taken_at_idx").on(t.takenAt), index("med_drug_idx").on(t.drug)],
);

/** 登入紀錄（F1） */
export const loginLogs = pgTable("login_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  lineUserId: varchar("line_user_id", { length: 64 }).notNull(),
  success: boolean("success").notNull(),
  createdAt: createdAt(),
});
