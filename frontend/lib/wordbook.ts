export interface WordbookEntry {
  /** 归一化后的词（词典词条或原形候选） */
  word: string;
  articleId: string | null;
  articleTitle: string | null;
  /** 回到语境的阅读页路径，如 /read/cet4-001 */
  readHref: string | null;
  sentenceId: string | null;
  sentenceEn: string | null;
  sentenceZh: string | null;
  addedAt: number;
}

const KEY = "wordscape:wordbook:v2";
const LEGACY_KEY = "wordscape:wordbook";

function migrateLegacy() {
  if (localStorage.getItem(KEY)) return;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return;

  try {
    const words = JSON.parse(legacy) as string[];
    const entries: WordbookEntry[] = words.map((word) => ({
      word,
      articleId: null,
      articleTitle: null,
      readHref: null,
      sentenceId: null,
      sentenceEn: null,
      sentenceZh: null,
      addedAt: Date.now(),
    }));
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // 旧数据损坏则放弃迁移
  }
  localStorage.removeItem(LEGACY_KEY);
}

export function loadWordbook(): WordbookEntry[] {
  if (typeof window === "undefined") return [];
  migrateLegacy();

  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as WordbookEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: WordbookEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent("wordscape:wordbook-changed"));
}

export function isInWordbook(entries: WordbookEntry[], word: string) {
  return entries.some((entry) => entry.word === word);
}

export function addWordbookEntry(entry: Omit<WordbookEntry, "addedAt">): WordbookEntry[] {
  const entries = loadWordbook();
  if (isInWordbook(entries, entry.word)) return entries;

  const next = [{ ...entry, addedAt: Date.now() }, ...entries];
  persist(next);
  return next;
}

export function removeWordbookEntry(word: string): WordbookEntry[] {
  const next = loadWordbook().filter((entry) => entry.word !== word);
  persist(next);
  return next;
}

export function wordbookCount() {
  return loadWordbook().length;
}
