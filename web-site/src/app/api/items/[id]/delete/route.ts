// 2026/11/12 - Arlen - 分類刪除；有記憶的分類與預設分類不可刪
import { deleteItem } from "@/server/items";
import { ok, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  await deleteItem(id);
  return ok({ id });
});
