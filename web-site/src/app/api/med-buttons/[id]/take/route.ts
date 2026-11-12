// 2026/11/12 - Arlen - 首頁一鍵吃藥：依按鈕藥單寫入吃藥紀錄
import { takeMedButton } from "@/server/medButtons";
import { ok, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireOwner();
  const { id } = await ctx.params;
  return ok(await takeMedButton(id), 201);
});
