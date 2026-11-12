// 2026/11/12 - Arlen - 記憶匯入（F6）：整批處理，同名記憶依 overwriteKeys 決定覆蓋或略過
import { importMemories, type ImportRow } from "@/server/memories";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const POST = route(async (req: Request) => {
  await requireOwner();
  const body = await readJson<{ rows?: Partial<ImportRow>[]; overwriteKeys?: string[] }>(req);
  return ok(await importMemories(body.rows ?? [], Array.isArray(body.overwriteKeys) ? body.overwriteKeys : []));
});
