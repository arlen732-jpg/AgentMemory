"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Activity, Brain, Check, ChevronRight, KeyRound, Pill } from "lucide-react";
import { useDialog } from "@/components/dialogs";
import { Badge, Card, Skeleton } from "@/components/ui";
import { apiPost, errorMessage } from "@/lib/api";
import type { MedButton } from "@/lib/types";
import { bpSummary } from "@/lib/bpStats";
import { fmtDateTime, startOfTaipeiDaysAgo } from "@/lib/dates";
import { useCollection } from "@/lib/store";
import { TOKEN_STATUS, tokenStatus } from "@/lib/tokens";

/** 依台北時間問候 */
function greeting() {
  const h = new Date(Date.now() + 8 * 3600_000).getUTCHours();
  if (h < 11) return "早安";
  if (h < 18) return "午安";
  return "晚安";
}

function StatCard({ href, icon, label, value, sub, testId }: { href: string; icon: ReactNode; label: string; value: ReactNode; sub: string; testId: string }) {
  return (
    <Link href={href} data-testid={testId}
      className="group flex flex-col rounded-md bg-surface p-5 shadow-sm transition-all duration-[var(--duration-base)] hover:-translate-y-px hover:shadow-md">
      <span className="flex items-center gap-2 text-sm text-fg-muted">{icon}{label}</span>
      <span className="mt-2 text-3xl font-bold text-fg">{value}</span>
      <span className="mt-1 flex items-center justify-between text-xs text-fg-muted">
        {sub}<ChevronRight size={16} className="text-fg-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

export default function HomePage() {
  // 2026/11/12 - Arlen - 血壓只查近 7 天、吃藥只查今天；查詢字串在首次渲染時固定，避免重複查詢
  const [q] = useState(() => ({
    week: new URLSearchParams({ from: startOfTaipeiDaysAgo(7) }).toString(),
    today: new URLSearchParams({ from: startOfTaipeiDaysAgo(1) }).toString(),
  }));
  const [memories] = useCollection("memories");
  const [bp] = useCollection("bp", q.week);
  const [med] = useCollection("med", q.today);
  const [tokens] = useCollection("tokens");
  const [medButtons] = useCollection("medButtons"); // 2026/11/12 - Arlen - 一鍵吃藥按鈕
  const [, medApi] = useCollection("med", q.today);
  const dialog = useDialog();
  const [taking, setTaking] = useState<string | null>(null);

  const loading = !memories || !bp || !med || !tokens;
  const s = bp ? bpSummary(bp) : null;
  const todayMeds = [...(med ?? [])].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const activeTokens = (tokens ?? []).filter((t) => tokenStatus(t) === TOKEN_STATUS.ACTIVE).length;
  const recent = [...(memories ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);

  // 2026/11/12 - Arlen - 一鍵吃藥：今天最後一次按的時間，以吃藥紀錄備註＝按鈕名稱判斷 - Start
  const lastTaken = (name: string) => todayMeds.filter((m) => m.note === name).at(-1)?.takenAt;

  const handleTake = async (b: MedButton) => {
    const last = lastTaken(b.name);
    if (last) {
      const again = await dialog.confirm({
        title: "再記一次？",
        message: `「${b.name}」今天 ${fmtDateTime(last).slice(11)} 已經記過，確定要再記一次嗎？`,
        confirmLabel: "再記一次",
      });
      if (!again) return;
    }
    setTaking(b.id);
    try {
      const res = await apiPost<{ count: number; takenAt: string }>(`/api/med-buttons/${b.id}/take`);
      medApi.reload();
      await dialog.notify({ ok: true, title: "已記錄", message: `「${b.name}」已在 ${fmtDateTime(res.takenAt).slice(11)} 記錄 ${res.count} 種藥。` });
    } catch (err) {
      await dialog.notify({ ok: false, title: "記錄失敗", message: errorMessage(err) });
    } finally {
      setTaking(null);
    }
  };
  // 2026/11/12 - Arlen - 一鍵吃藥 - end

  return (
    <>
      {/* 2026/11/12 - Arlen - 一鍵吃藥按鈕放最上面方便手機操作；未吃綠底白字，已吃淡綠底加打勾 */}
      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-fg">吃藥</h2>
          <Link href="/med/buttons" className="text-sm text-primary-text hover:underline" data-testid="home-med-buttons-link">設定</Link>
        </div>
        {!medButtons ? (
          <Skeleton rows={1} />
        ) : medButtons.length === 0 ? (
          <p className="py-4 text-center text-sm text-fg-muted">還沒有吃藥按鈕，請到「吃藥按鈕設定」新增。</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {medButtons.map((b) => {
              const last = lastTaken(b.name);
              return (
                <button key={b.id} type="button" onClick={() => handleTake(b)} disabled={!b.drugs.length || taking === b.id}
                  title={b.drugs.length ? undefined : "還沒有設定藥單"} data-testid="home-med-take-btn"
                  className={`flex min-h-20 flex-col items-start rounded-md border p-3 text-left transition-opacity duration-[var(--duration-base)] disabled:cursor-not-allowed disabled:opacity-50 ${
                    last ? "border-success bg-success-subtle text-success" : "border-success bg-success text-white hover:opacity-90"}`}>
                  <span className="flex w-full items-center justify-between text-lg font-semibold">
                    {b.name}
                    {last && <span className="flex items-center gap-1 text-xs"><Check size={14} aria-hidden />{fmtDateTime(last).slice(11)}</span>}
                  </span>
                  <span className={`mt-1 text-xs ${last ? "text-fg-secondary" : "text-white/90"}`}>
                    {b.drugs.length ? b.drugs.map((d) => `${d.drug} ${d.dose}`).join("、") : "還沒有設定藥單"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <section className="img-fallback relative mb-6 overflow-hidden rounded-lg shadow-sm" data-testid="home-banner">
        <Image src="/assets/dashboard-banner.webp" alt="" fill priority className="object-cover object-right" />
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">{greeting()}，Arlen</h1>
          <p className="mt-2 text-sm text-fg-secondary">
            {loading ? "載入中…" : `目前有 ${memories.length} 筆記憶、${activeTokens} 組有效通行碼。`}
          </p>
        </div>
      </section>

      {loading ? (
        <Skeleton rows={4} />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard href="/memories" testId="home-stat-memories" icon={<Brain size={18} strokeWidth={1.75} aria-hidden />}
              label="記憶" value={memories.length} sub="筆" />
            <StatCard href="/bp" testId="home-stat-bp" icon={<Activity size={18} strokeWidth={1.75} aria-hidden />}
              label="7 天血壓平均" value={s?.systolic ? `${s.systolic.avg}/${s.diastolic!.avg}` : "—"} sub={`${s?.count ?? 0} 筆紀錄`} />
            <StatCard href="/med" testId="home-stat-med" icon={<Pill size={18} strokeWidth={1.75} aria-hidden />}
              label="今天吃藥" value={todayMeds.length} sub="次" />
            <StatCard href="/tokens" testId="home-stat-tokens" icon={<KeyRound size={18} strokeWidth={1.75} aria-hidden />}
              label="有效通行碼" value={activeTokens} sub="組" />
          </div>


          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-fg">今天的吃藥紀錄</h2>
              {todayMeds.length === 0 ? (
                <p className="py-6 text-center text-sm text-fg-muted">今天還沒有吃藥紀錄。</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {todayMeds.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-3 text-sm">
                      <span className="w-12 text-fg-muted">{fmtDateTime(m.takenAt).slice(11)}</span>
                      <span className="font-medium text-fg">{m.drug}</span>
                      <Badge tone="primary">{m.dose}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-fg">最近更新的記憶</h2>
              <ul className="divide-y divide-neutral-100">
                {recent.map((m) => (
                  <li key={m.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-fg">{m.key}</span>
                      <span className="text-xs text-fg-muted">{fmtDateTime(m.updatedAt)}</span>
                    </div>
                    <p className="text-sm text-secondary-text">{m.summary}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
