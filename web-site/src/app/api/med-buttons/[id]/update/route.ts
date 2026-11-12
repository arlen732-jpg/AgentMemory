// 2026/11/12 - Arlen - 吃藥按鈕修改（名稱、順序、藥單整批）；DevGuidelines 禁用 PUT，一律 POST
import { updateMedButton, type MedButtonPayload } from "@/server/medButtons";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  return ok(await updateMedButton(id, await readJson<MedButtonPayload>(req)));
});
