// 2026/11/12 - Arlen - 曾用藥名（F9 藥名提示）
import { listDrugs } from "@/server/med";
import { ok, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const GET = route(async () => {
  await requireOwner();
  return ok(await listDrugs());
});
