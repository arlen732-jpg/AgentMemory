// 2026/11/12 - Arlen - 吃藥刪除（F9）；DevGuidelines 禁用 DELETE，一律 POST
import { deleteMed } from "@/server/med";
import { ok, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  await deleteMed(id);
  return ok({ id });
});
