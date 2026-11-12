"use client";

// 2026/11/12 - Arlen - 資料存取層：由 sessionStorage mock 改為呼叫 API
// 頁面介面維持 [items, api]；items 為 null 代表載入中（顯示骨架屏）
// 寫入一律 await，成功後重新載入同一集合的所有查詢；失敗丟 ClientApiError

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { apiGet, apiPost } from "./api";
import type { CollectionName, Collections } from "./types";

const BASE: Record<CollectionName, string> = {
  memories: "/api/memories",
  items: "/api/items",
  bp: "/api/bp",
  med: "/api/med",
  tokens: "/api/tokens",
};

type Entry = { data: unknown[] | null; error: string | null; loading: boolean };
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const EMPTY: Entry = { data: null, error: null, loading: false };

const keyOf = (name: CollectionName, query: string) => `${name}?${query}`;
const notify = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

async function load(name: CollectionName, query: string) {
  const k = keyOf(name, query);
  const prev = entries.get(k) ?? EMPTY;
  if (prev.loading) return;
  entries.set(k, { ...prev, loading: true });
  try {
    const data = await apiGet<unknown[]>(query ? `${BASE[name]}?${query}` : BASE[name]);
    entries.set(k, { data, error: null, loading: false });
  } catch (e) {
    entries.set(k, { data: prev.data ?? [], error: e instanceof Error ? e.message : "載入失敗", loading: false });
  }
  notify();
}

// 2026/11/12 - Arlen - 分類維護：記憶異動會改變分類的記憶筆數；分類改名會改變記憶的分類，兩者互相連帶重新載入
const RELATED: Partial<Record<CollectionName, CollectionName[]>> = { memories: ["items"], items: ["memories"] };

/** 重新載入某集合（與連帶集合）目前畫面上用到的所有查詢 */
export function invalidate(name: CollectionName) {
  for (const n of [name, ...(RELATED[name] ?? [])]) {
    for (const k of entries.keys()) {
      if (k.startsWith(`${n}?`)) void load(n, k.slice(n.length + 1));
    }
  }
  if (name === "med" && drugs.loaded) void loadDrugs();
}

// 2026/11/12 - Arlen - 曾用藥名（F9）：獨立快取，吃藥資料異動時一併重新載入
const drugs: { list: string[]; loaded: boolean } = { list: [], loaded: false };

async function loadDrugs() {
  drugs.loaded = true;
  try {
    drugs.list = await apiGet<string[]>("/api/med/drugs");
  } catch {
    drugs.list = [];
  }
  notify();
}

export function useMedDrugs(): string[] {
  const list = useSyncExternalStore(subscribe, () => drugs.list, () => drugs.list);
  useEffect(() => {
    if (!drugs.loaded) void loadDrugs();
  }, []);
  return list;
}

/**
 * 讀取集合；query 是 URLSearchParams 字串（例：from=...&to=...），改變時自動重新查詢。
 * 回傳 [items, api, error]。
 */
export function useCollection<K extends CollectionName>(name: K, query = "") {
  const k = keyOf(name, query);
  const entry = useSyncExternalStore(subscribe, () => entries.get(k) ?? EMPTY, () => EMPTY);

  useEffect(() => {
    if (!entries.get(k)?.data) void load(name, query);
  }, [k, name, query]);

  const add = useCallback(async (body: unknown) => {
    const row = await apiPost<Collections[K]>(BASE[name], body);
    invalidate(name);
    return row;
  }, [name]);
  const update = useCallback(async (id: string, body: unknown) => {
    const row = await apiPost<Collections[K]>(`${BASE[name]}/${id}/update`, body);
    invalidate(name);
    return row;
  }, [name]);
  const remove = useCallback(async (id: string) => {
    await apiPost(`${BASE[name]}/${id}/delete`);
    invalidate(name);
  }, [name]);
  const reload = useCallback(() => invalidate(name), [name]);

  const api = useMemo(() => ({ add, update, remove, reload }), [add, update, remove, reload]);
  return [entry.data as Collections[K][] | null, api, entry.error] as const;
}
