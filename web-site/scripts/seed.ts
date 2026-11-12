// 2026/11/12 - Arlen - Seed：把 demo-site 的 mock 資料寫進 Neon dev branch
// 執行：npm run db:seed（以 react-server 條件執行，才能載入 server-only 模組）
// 安全：任一資料表已有資料就整個中止，不覆蓋既有資料；通行碼不 seed
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { count } = await import("drizzle-orm");
  const { db } = await import("@/server/db");
  const { encryptNote } = await import("@/server/crypto");
  const { bpRecords, medRecords, memories } = await import("@/db/schema");
  const { seedMemories } = await import("./seed-data/memories");
  const { seedBp, seedMed } = await import("./seed-data/health");

  for (const t of [memories, bpRecords, medRecords]) {
    const [{ n }] = await db().select({ n: count() }).from(t);
    if (n > 0) {
      console.log("資料表已有資料，不執行 seed。");
      return;
    }
  }

  await db().insert(memories).values(
    seedMemories().map(({ id: _id, updatedAt, ...m }) => ({ ...m, updatedAt: new Date(updatedAt) })),
  );
  await db().insert(bpRecords).values(
    seedBp().map(({ id: _id, measuredAt, note, ...b }) => ({ ...b, measuredAt: new Date(measuredAt), note: encryptNote(note) })),
  );
  await db().insert(medRecords).values(
    seedMed().map(({ id: _id, takenAt, note, ...m }) => ({ ...m, takenAt: new Date(takenAt), note: encryptNote(note) })),
  );
  console.log("seed 完成。");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
