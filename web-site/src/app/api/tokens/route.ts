// 2026/11/12 - Arlen - 通行碼列表／產生（F2）；產生時原文只在這次回應出現
import { createToken, listTokens } from "@/server/tokens";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const GET = route(async () => {
  await requireOwner();
  return ok(await listTokens());
});

export const POST = route(async (req: Request) => {
  await requireOwner();
  return ok(await createToken(await readJson<{ name?: string; expires?: string }>(req)), 201);
});
