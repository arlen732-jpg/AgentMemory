"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, Brain, ChevronRight, KeyRound, Pill } from "lucide-react";
import { Badge, Card, Skeleton } from "@/components/ui";
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
  const [memories] = useCollection("memories");
  const [bp] = useCollection("bp");
  const [med] = useCollection("med");
  const [tokens] = useCollection("tokens");

  const loading = !memories || !bp || !med || !tokens;
  const week = startOfTaipeiDaysAgo(7);
  const today = startOfTaipeiDaysAgo(1);
  const s = bp ? bpSummary(bp.filter((r) => r.measuredAt >= week)) : null;
  const todayMeds = (med ?? []).filter((m) => m.takenAt >= today).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const activeTokens = (tokens ?? []).filter((t) => tokenStatus(t) === TOKEN_STATUS.ACTIVE).length;
  const recent = [...(memories ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);

  return (
    <>
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
