// 2026/11/12 - Arlen - 記憶修改（F4）；DevGuidelines 禁用 PUT，一律 POST
import { updateMemory } from "@/server/memories";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";
import type { MemoryInput } from "@/lib/validation";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  return ok(await updateMemory(id, await readJson<Partial<MemoryInput>>(req)));
});
