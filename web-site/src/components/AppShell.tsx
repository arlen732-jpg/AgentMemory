"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity, Brain, ChevronDown, FolderTree, House, KeyRound, LogOut, Menu, Pill, Upload, X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";

type NavLeaf = { label: string; href: string; icon: LucideIcon; testId: string };
type NavGroup = { label: string; children: NavLeaf[] };
type NavEntry = NavLeaf | NavGroup;

// 2026/11/12 - Arlen - 階層式選單（DemoSite Q6）
const NAV: NavEntry[] = [
  { label: "首頁", href: "/", icon: House, testId: "nav-home" },
  {
    label: "記憶",
    children: [
      { label: "記憶列表", href: "/memories", icon: Brain, testId: "nav-memories" },
      { label: "匯入 memory.json", href: "/memories/import", icon: Upload, testId: "nav-import" },
      { label: "分類維護", href: "/items", icon: FolderTree, testId: "nav-items" }, // 2026/11/12 - Arlen - 分類維護
    ],
  },
  {
    label: "健康紀錄",
    children: [
      { label: "血壓", href: "/bp", icon: Activity, testId: "nav-bp" },
      { label: "吃藥", href: "/med", icon: Pill, testId: "nav-med" },
    ],
  },
  {
    label: "系統",
    children: [{ label: "通行碼", href: "/tokens", icon: KeyRound, testId: "nav-tokens" }],
  },
];

const isGroup = (e: NavEntry): e is NavGroup => "children" in e;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // 「記憶列表」不應在匯入頁時同時亮起
  return pathname === href;
}

function NavLink({ leaf, pathname, onNavigate }: { leaf: NavLeaf; pathname: string; onNavigate: () => void }) {
  const active = isActive(pathname, leaf.href);
  const Icon = leaf.icon;
  return (
    <Link
      href={leaf.href}
      onClick={onNavigate}
      data-testid={leaf.testId}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-[var(--duration-base)] ${
        active
          ? "bg-primary-subtle font-semibold text-primary-text"
          : "text-fg-secondary hover:bg-muted hover:text-fg"
      }`}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden />
      {leaf.label}
    </Link>
  );
}

function NavTree({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <nav aria-label="主選單" className="flex flex-col gap-1">
      {NAV.map((entry) => {
        if (!isGroup(entry)) return <NavLink key={entry.href} leaf={entry} pathname={pathname} onNavigate={onNavigate} />;
        const open = !collapsed[entry.label];
        return (
          <div key={entry.label} className="mt-3">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [entry.label]: open }))}
              aria-expanded={open}
              data-testid={`nav-group-${entry.label}`}
              className="flex min-h-9 w-full items-center justify-between rounded-sm px-3 text-xs font-semibold tracking-wide text-fg-muted hover:text-fg"
            >
              {entry.label}
              <ChevronDown
                size={16}
                strokeWidth={1.75}
                aria-hidden
                className={`transition-transform duration-[var(--duration-base)] ${open ? "" : "-rotate-90"}`}
              />
            </button>
            {open && (
              <div className="mt-1 flex flex-col gap-1 pl-2">
                {entry.children.map((leaf) => (
                  <NavLink key={leaf.href} leaf={leaf} pathname={pathname} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-3" data-testid="nav-brand">
      <Image src="/assets/app-icon.png" alt="" width={32} height={32} />
      <span className="text-base font-bold text-fg">個人記憶庫</span>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 2026/11/12 - Arlen - 登出改走 Auth.js，清除 session cookie
  const handleLogout = () => signOut({ redirectTo: "/login" });

  const sidebarBody = (
    <div className="flex h-full flex-col gap-6 py-5">
      <Brand />
      <div className="flex-1 overflow-y-auto px-3">
        <NavTree pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
      </div>
      <div className="px-3">
        <button
          type="button"
          onClick={handleLogout}
          data-testid="logout-btn"
          className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-sm text-fg-secondary hover:bg-muted hover:text-fg"
        >
          <LogOut size={20} strokeWidth={1.75} aria-hidden />
          登出
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* 桌面：固定側邊欄 */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-neutral-200 bg-surface lg:block">
        {sidebarBody}
      </aside>

      {/* 手機／平板：頂部列＋漢堡選單 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-surface/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="開啟選單"
          data-testid="nav-menu-btn"
          className="flex h-11 w-11 items-center justify-center rounded-sm text-fg hover:bg-muted"
        >
          <Menu size={24} strokeWidth={1.75} aria-hidden />
        </button>
        <Brand />
        <span className="w-11" />
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="主選單">
          <div className="absolute inset-0 bg-neutral-900/30" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-surface shadow-lg">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="關閉選單"
              data-testid="nav-close-btn"
              className="absolute right-2 top-3 flex h-11 w-11 items-center justify-center rounded-sm text-fg-secondary hover:bg-muted"
            >
              <X size={22} strokeWidth={1.75} aria-hidden />
            </button>
            {sidebarBody}
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
