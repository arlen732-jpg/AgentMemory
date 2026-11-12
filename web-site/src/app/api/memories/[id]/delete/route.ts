// 2026/11/12 - Arlen - 記憶刪除（F4）；DevGuidelines 禁用 DELETE，一律 POST
import { deleteMemory } from "@/server/memories";
import { ok, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  await deleteMemory(id);
  return ok(null);
});
