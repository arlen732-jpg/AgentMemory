// 2026/11/12 - Arlen - 血壓修改（F7）；DevGuidelines 禁用 PUT，一律 POST
import { updateBp, type BpPayload } from "@/server/bp";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  return ok(await updateBp(id, await readJson<BpPayload>(req)));
});
