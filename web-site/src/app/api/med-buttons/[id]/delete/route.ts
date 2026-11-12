// 2026/11/12 - Arlen - 吃藥按鈕刪除（藥單由外鍵 cascade 一併刪除）；DevGuidelines 禁用 DELETE，一律 POST
import { deleteMedButton } from "@/server/medButtons";
import { ok, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  await deleteMedButton(id);
  return ok(null);
});
