// 2026/11/12 - Arlen - 吃藥修改（F9）；DevGuidelines 禁用 PUT，一律 POST
import { updateMed, type MedPayload } from "@/server/med";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  return ok(await updateMed(id, await readJson<MedPayload>(req)));
});
