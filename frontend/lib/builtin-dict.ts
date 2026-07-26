"use client";

import { getDictEntry, type DictEntry } from "@/lib/seed-data";

let cache: Record<string, DictEntry> | null = null;
let loading: Promise<void> | null = null;

/** 懒加载内置课程词典（public/dict/builtin.json，由 export_frontend_data.py 产出）。 */
export function ensureBuiltinDict(): Promise<void> {
  if (cache) return Promise.resolve();

  loading ??= fetch("/dict/builtin.json")
    .then((response) => (response.ok ? response.json() : {}))
    .then((data: Record<string, DictEntry>) => {
      cache = data && typeof data === "object" ? data : {};
    })
    .catch(() => {
      cache = {};
    });

  return loading;
}

/** 统一查词：种子词典优先，其次是内置课程词典（需先 ensureBuiltinDict）。 */
export function lookupDict(word: string): DictEntry | undefined {
  const key = word.toLowerCase();
  return getDictEntry(key) ?? cache?.[key];
}
