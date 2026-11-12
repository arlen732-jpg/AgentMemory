// 2026/11/12 - Arlen - 通行碼撤銷（F2）；撤銷後不可恢復
import { revokeToken } from "@/server/tokens";
import { ok, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  return ok(await revokeToken(id));
});
