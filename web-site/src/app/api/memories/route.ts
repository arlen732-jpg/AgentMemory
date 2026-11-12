// 2026/11/12 - Arlen - 記憶列表／新增（F4）
import { createMemory, listMemories } from "@/server/memories";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";
import type { MemoryInput } from "@/lib/validation";

export const GET = route(async (req: Request) => {
  await requireOwner();
  const p = new URL(req.url).searchParams;
  return ok(await listMemories({ item: p.get("item") ?? undefined, tag: p.get("tag") ?? undefined, q: p.get("q") ?? undefined }));
});

export const POST = route(async (req: Request) => {
  await requireOwner();
  return ok(await createMemory(await readJson<Partial<MemoryInput>>(req)), 201);
});
