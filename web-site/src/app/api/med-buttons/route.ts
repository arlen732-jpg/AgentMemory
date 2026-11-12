// 2026/11/12 - Arlen - 吃藥按鈕設定：清單與新增
import { createMedButton, listMedButtons, type MedButtonPayload } from "@/server/medButtons";
import { ok, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/session";

export const GET = route(async () => {
  await requireOwner();
  return ok(await listMedButtons());
});

export const POST = route(async (req: Request) => {
  await requireOwner();
  return ok(await createMedButton(await readJson<MedButtonPayload>(req)), 201);
});
