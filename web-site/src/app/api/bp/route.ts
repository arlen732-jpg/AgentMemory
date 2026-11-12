// 2026/11/12 - Arlen - 血壓列表／新增（F7）；GET 可帶 from、to（ISO-8601）
import { createBp, listBp, parseRange, type BpPayload } from "@/server/bp";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const GET = route(async (req: Request) => {
  await requireOwner();
  const p = new URL(req.url).searchParams;
  return ok(await listBp(parseRange(p.get("from"), p.get("to"))));
});

export const POST = route(async (req: Request) => {
  await requireOwner();
  return ok(await createBp(await readJson<BpPayload>(req)), 201);
});
