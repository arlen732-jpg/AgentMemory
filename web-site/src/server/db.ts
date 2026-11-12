// 2026/11/12 - Arlen - DB 連線：Neon HTTP driver（Serverless 友善，無連線池）
import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

let instance: ReturnType<typeof create> | null = null;

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("未設定 DATABASE_URL");
  return drizzle(neon(url), { schema });
}

/** 延遲建立：build 階段沒有 DATABASE_URL 也不會失敗 */
export function db() {
  instance ??= create();
  return instance;
}
