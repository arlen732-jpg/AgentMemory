// 2026/11/12 - Arlen - 吃藥列表／新增（F9）；GET 可帶 from、to（ISO-8601）、drug
import { parseRange } from "@/server/bp";
import { createMed, listMed, type MedPayload } from "@/server/med";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const GET = route(async (req: Request) => {
  await requireOwner();
  const p = new URL(req.url).searchParams;
  return ok(await listMed({ ...parseRange(p.get("from"), p.get("to")), drug: p.get("drug") ?? undefined }));
});

export const POST = route(async (req: Request) => {
  await requireOwner();
  return ok(await createMed(await readJson<MedPayload>(req)), 201);
});
