import { lemmaCandidates } from "@/lib/lemma";

export interface LookupRecord {
  word: string;
  count: number;
  lastAt: number;
}

const KEY = "wordscape:lookups";

export function loadLookupHistory(): LookupRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as LookupRecord[]) : [];
  } catch {
    return [];
  }
}

/** 我查过的词集合（含各原形候选，小写），用于阅读时淡色标记同词的其他变形。 */
export function loadLookupSet(): Set<string> {
  const set = new Set<string>();
  loadLookupHistory().forEach((record) => {
    lemmaCandidates(record.word).forEach((candidate) => set.add(candidate));
  });
  return set;
}

export function recordLookup(word: string) {
  const key = word.toLowerCase();
  const records = loadLookupHistory();
  const existing = records.find((record) => record.word === key);

  if (existing) {
    existing.count += 1;
    existing.lastAt = Date.now();
  } else {
    records.push({ word: key, count: 1, lastAt: Date.now() });
  }

  localStorage.setItem(KEY, JSON.stringify(records));
  window.dispatchEvent(new CustomEvent("wordscape:lookups-changed"));
}
