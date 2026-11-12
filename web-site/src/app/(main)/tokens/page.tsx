"use client";

import { useMemo, useState } from "react";
import { Check, Copy, KeyRound, TriangleAlert } from "lucide-react";
import { useDialog } from "@/components/dialogs";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Skeleton, TextInput } from "@/components/ui";
import { apiPost, ClientApiError, errorMessage } from "@/lib/api";
import { fmtDate, fmtDateTime, toDateInput } from "@/lib/dates";
import { useCollection } from "@/lib/store";
import {
  TOKEN_DEFAULT_DAYS, TOKEN_MAX_DAYS, TOKEN_STATUS, TOKEN_STATUS_LABEL, tokenStatus, type TokenStatus,
} from "@/lib/tokens";
import { LIMITS } from "@/lib/validation";

const STATUS_TONE: Record<TokenStatus, "success" | "neutral" | "danger"> = { active: "success", expired: "neutral", revoked: "danger" };

// FSD F11 指路牌範本（G-13：網頁提供複製）
const SIGNPOST = `## 個人記憶庫
個人資訊（作息、喜好、健康紀錄）存在 MCP \`agentmemory\`。
需要時先呼叫 memory_get(item="個人", key="index") 看目錄，再取需要的那一筆。`;

const dateAfter = (days: number) => toDateInput(Date.now() + days * 86400_000);

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
  };
  return { copied, copy };
}

export default function TokensPage() {
  const [tokens, api] = useCollection("tokens");
  const dialog = useDialog();
  const { copied, copy } = useCopy();
  const [name, setName] = useState("");
  const [expires, setExpires] = useState(() => dateAfter(TOKEN_DEFAULT_DAYS));
  const [errors, setErrors] = useState<{ name?: string; expires?: string }>({});
  const [secret, setSecret] = useState<{ name: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => {
    const order: Record<TokenStatus, number> = { active: 0, expired: 1, revoked: 2 };
    return [...(tokens ?? [])].sort((a, b) => order[tokenStatus(a)] - order[tokenStatus(b)] || b.createdAt.localeCompare(a.createdAt));
  }, [tokens]);

  // 2026/11/12 - Arlen - F2：名稱不可與有效通行碼重名；到期日不超過 TOKEN_MAX_DAYS
  const handleCreate = async () => {
    const n = name.trim();
    const e: typeof errors = {};
    if (!n) e.name = "請輸入名稱";
    else if ((tokens ?? []).some((t) => t.name === n && tokenStatus(t) === TOKEN_STATUS.ACTIVE)) e.name = "已有同名的有效通行碼";
    if (expires) {
      if (expires < dateAfter(1)) e.expires = "到期日至少是明天";
      else if (expires > dateAfter(TOKEN_MAX_DAYS)) e.expires = `到期日最多 ${TOKEN_MAX_DAYS} 天後`;
    }
    setErrors(e);
    if (Object.keys(e).length) {
      await dialog.notify({ ok: false, title: "產生失敗", message: "有欄位未通過檢查，請依紅字修正後重新產生。" });
      return;
    }
    // 2026/11/12 - Arlen - 改由後端產生；原文只在這次回應出現，關閉跳窗後就看不到 - Start
    setSaving(true);
    let value: string;
    try {
      const res = await apiPost<{ secret: string }>("/api/tokens", { name: n, expires });
      value = res.secret;
    } catch (err) {
      if (err instanceof ClientApiError) setErrors(err.fields as typeof errors);
      await dialog.notify({ ok: false, title: "產生失敗", message: errorMessage(err) });
      return;
    } finally {
      setSaving(false);
    }
    api.reload();
    setSecret({ name: n, value });
    // 2026/11/12 - Arlen - 改由後端產生 - end
    setName("");
    setExpires(dateAfter(TOKEN_DEFAULT_DAYS));
  };

  const handleRevoke = async (id: string, tokenName: string) => {
    const ok = await dialog.confirm({
      title: "撤銷通行碼",
      message: `撤銷「${tokenName}」後，使用它的 AI 助手會立即無法讀寫資料，而且無法恢復。`,
      confirmLabel: "撤銷", danger: true,
    });
    if (!ok) return;
    try {
      await apiPost(`/api/tokens/${id}/revoke`);
    } catch (err) {
      await dialog.notify({ ok: false, title: "撤銷失敗", message: errorMessage(err) });
      return;
    } finally {
      api.reload();
    }
    await dialog.notify({ ok: true, title: "已撤銷", message: `通行碼「${tokenName}」已撤銷，其他通行碼不受影響。` });
  };

  return (
    <>
      <PageHeader title="通行碼" description="每台電腦的 AI 助手用一組通行碼連進記憶庫。系統只保存指紋，原文只在產生時顯示一次。" />

      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-fg">產生新的通行碼</h2>
          <div className="grid gap-x-4 sm:grid-cols-[1fr_12rem]">
            <Field label="名稱" required htmlFor="token-name" error={errors.name}>
              <TextInput id="token-name" value={name} maxLength={LIMITS.tokenName} invalid={!!errors.name}
                onChange={(e) => setName(e.target.value)} placeholder="例：家裡電腦" data-testid="token-name-input" />
            </Field>
            <Field label="到期日" htmlFor="token-expires" error={errors.expires} hint={`預設 ${TOKEN_DEFAULT_DAYS} 天`}>
              <TextInput id="token-expires" type="date" value={expires} min={dateAfter(1)} max={dateAfter(TOKEN_MAX_DAYS)}
                invalid={!!errors.expires} onChange={(e) => setExpires(e.target.value)} data-testid="token-expires-input" />
            </Field>
          </div>
          <Button onClick={handleCreate} disabled={saving} data-testid="token-create-btn"><KeyRound size={18} strokeWidth={1.75} aria-hidden />產生</Button>
        </Card>

        <Card className="bg-primary-subtle">
          <h2 className="text-lg font-semibold text-fg">指路牌</h2>
          <p className="mt-1 text-sm text-fg-secondary">貼到每台電腦的 <code>~/.claude/CLAUDE.md</code>，AI 需要個人資訊時才會來查。</p>
          <pre className="mt-3 whitespace-pre-wrap break-all rounded-sm bg-surface p-3 text-xs leading-relaxed text-fg">{SIGNPOST}</pre>
          <Button variant="secondary" className="mt-3 w-full" onClick={() => copy("signpost", SIGNPOST)} data-testid="token-copy-signpost-btn">
            {copied === "signpost" ? <Check size={18} aria-hidden /> : <Copy size={18} strokeWidth={1.75} aria-hidden />}
            {copied === "signpost" ? "已複製" : "複製指路牌"}
          </Button>
        </Card>
      </div>

      {tokens === null ? (
        <Skeleton rows={4} />
      ) : sorted.length === 0 ? (
        <Card><EmptyState title="還沒有通行碼" description="替第一台電腦產生一組吧。" /></Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-fg-muted">
                  <th className="px-5 py-3 font-medium">名稱</th>
                  <th className="px-3 py-3 font-medium">狀態</th>
                  <th className="px-3 py-3 font-medium">建立日期</th>
                  <th className="px-3 py-3 font-medium">到期日</th>
                  <th className="px-3 py-3 font-medium">最後使用</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const st = tokenStatus(t);
                  return (
                    <tr key={t.id} className="border-b border-neutral-100 last:border-0" data-testid="token-row">
                      <td className="px-5 py-3">
                        <span className="font-semibold text-fg">{t.name}</span>
                        <span className="ml-2 font-mono text-xs text-fg-muted">…{t.tokenPreview}</span>
                      </td>
                      <td className="px-3 py-3"><Badge tone={STATUS_TONE[st]}>{TOKEN_STATUS_LABEL[st]}</Badge></td>
                      <td className="px-3 py-3 text-fg-secondary">{fmtDate(t.createdAt)}</td>
                      <td className="px-3 py-3 text-fg-secondary">{fmtDate(t.expiresAt)}</td>
                      <td className="px-3 py-3 text-fg-secondary">{t.lastUsedAt ? fmtDateTime(t.lastUsedAt) : "—"}</td>
                      <td className="px-5 py-3 text-right">
                        {st === TOKEN_STATUS.ACTIVE && (
                          <Button variant="ghost" className="text-danger" onClick={() => handleRevoke(t.id, t.name)} data-testid="token-revoke-btn">撤銷</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {secret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="通行碼已產生" data-testid="token-secret-dialog">
          <div className="absolute inset-0 bg-neutral-900/40" />
          <div className="relative w-full max-w-md rounded-lg bg-surface p-6 shadow-lg">
            <p className="text-lg font-semibold text-fg">通行碼「{secret.name}」已產生</p>
            <div className="mt-3 flex items-start gap-2 rounded-sm bg-warning-subtle p-3 text-sm text-warning">
              <TriangleAlert size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
              關閉後將無法再看到這組通行碼。忘記抄下時，只能撤銷後重新產生。
            </div>
            <div className="mt-4 flex items-center gap-2">
              <code className="flex-1 break-all rounded-sm bg-muted px-3 py-2 font-mono text-sm text-fg" data-testid="token-secret-value">{secret.value}</code>
              <Button variant="secondary" onClick={() => copy("secret", secret.value)} data-testid="token-secret-copy-btn">
                {copied === "secret" ? <Check size={18} aria-hidden /> : <Copy size={18} strokeWidth={1.75} aria-hidden />}
                {copied === "secret" ? "已複製" : "複製"}
              </Button>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setSecret(null)} data-testid="token-secret-close-btn">我已抄下，關閉</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
