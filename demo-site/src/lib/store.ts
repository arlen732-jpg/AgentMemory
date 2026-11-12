"use client";

// 2026/11/12 - Arlen - 資料存取層：mock 初始值 + sessionStorage 暫存（DevGuidelines 禁用 localStorage）
// 正式版改為呼叫 API／Drizzle，頁面只透過 useCollection 存取，換實作時頁面不必改

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { CollectionName, Collections } from "./types";
import { seedMemories } from "@/mock/memories";
import { seedBp, seedMed } from "@/mock/health";
import { seedTokens } from "@/mock/tokens";

const PREFIX = "am.data.";

const seeds: { [K in CollectionName]: () => Collections[K][] } = {
  memories: seedMemories,
  bp: seedBp,
  med: seedMed,
  tokens: seedTokens,
};

const cache: Partial<{ [K in CollectionName]: Collections[K][] }> = {};
const listeners = new Set<() => void>();

function read<K extends CollectionName>(name: K): Collections[K][] {
  const hit = cache[name];
  if (hit) return hit as Collections[K][];
  let data: Collections[K][];
  const raw = sessionStorage.getItem(PREFIX + name);
  if (raw) {
    try {
      data = JSON.parse(raw) as Collections[K][];
    } catch {
      data = seeds[name]();
    }
  } else {
    data = seeds[name]();
    sessionStorage.setItem(PREFIX + name, JSON.stringify(data));
  }
  cache[name] = data as never;
  return data;
}

function write<K extends CollectionName>(name: K, data: Collections[K][]) {
  cache[name] = data as never;
  sessionStorage.setItem(PREFIX + name, JSON.stringify(data));
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function newId() {
  return crypto.randomUUID();
}

/** 讀取整個集合；SSR 與首次水合期間回傳 null，頁面據此顯示骨架屏 */
export function useCollection<K extends CollectionName>(name: K) {
  const items = useSyncExternalStore(
    subscribe,
    () => read(name),
    () => null,
  );

  const add = useCallback((row: Collections[K]) => write(name, [...read(name), row]), [name]);
  const update = useCallback(
    (id: string, patch: Partial<Collections[K]>) =>
      write(name, read(name).map((r) => (r.id === id ? { ...r, ...patch } : r))),
    [name],
  );
  const remove = useCallback((id: string) => write(name, read(name).filter((r) => r.id !== id)), [name]);
  const replaceAll = useCallback((rows: Collections[K][]) => write(name, rows), [name]);

  const api = useMemo(() => ({ add, update, remove, replaceAll }), [add, update, remove, replaceAll]);
  return [items, api] as const;
}

/** 回到 mock 初始值（Demo 用） */
export function resetAll() {
  (Object.keys(seeds) as CollectionName[]).forEach((n) => {
    sessionStorage.removeItem(PREFIX + n);
    delete cache[n];
  });
  listeners.forEach((l) => l());
}
