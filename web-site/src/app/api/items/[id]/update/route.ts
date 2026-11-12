// 2026/11/12 - Arlen - 分類改名；DevGuidelines 禁用 PUT，一律 POST
import { renameItem } from "@/server/items";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  return ok(await renameItem(id, await readJson<{ name?: unknown }>(req)));
});
