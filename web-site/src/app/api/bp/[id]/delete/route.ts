// 2026/11/12 - Arlen - 血壓刪除（F7）；DevGuidelines 禁用 DELETE，一律 POST
import { deleteBp } from "@/server/bp";
import { ok, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  await deleteBp(id);
  return ok({ id });
});
