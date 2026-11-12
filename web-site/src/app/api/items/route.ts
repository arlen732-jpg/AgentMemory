// 2026/11/12 - Arlen - 分類維護：清單與新增
import { createItem, listItems } from "@/server/items";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const GET = route(async () => {
  await requireOwner();
  return ok(await listItems());
});

export const POST = route(async (req: Request) => {
  await requireOwner();
  return ok(await createItem(await readJson<{ name?: unknown }>(req)), 201);
});
