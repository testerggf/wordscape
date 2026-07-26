export interface QuizResult {
  correct: number;
  total: number;
  at: number;
}

export interface ArticleProgress {
  /** 阅读位置百分比，未完成时上限 99 */
  percent: number;
  /** 上次阅读位置的句子锚点 id，如 "2-3" */
  anchorSentenceId: string | null;
  /** 是否已完成本篇（点完成/完成小测才置位，与滚动解耦） */
  completed: boolean;
  /** 最近一次读后小测成绩 */
  quiz: QuizResult | null;
  updatedAt: number;
}

const keyOf = (articleId: string) => `wordscape:progress:v2:${articleId}`;
const legacyKeyOf = (articleId: string) => `wordscape:progress:${articleId}`;

export const EMPTY_PROGRESS: ArticleProgress = {
  percent: 0,
  anchorSentenceId: null,
  completed: false,
  quiz: null,
  updatedAt: 0,
};

export function loadProgress(articleId: string): ArticleProgress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;

  const saved = localStorage.getItem(keyOf(articleId));
  if (saved) {
    try {
      return { ...EMPTY_PROGRESS, ...(JSON.parse(saved) as Partial<ArticleProgress>) };
    } catch {
      return EMPTY_PROGRESS;
    }
  }

  // 迁移旧的纯百分比进度
  const legacy = localStorage.getItem(legacyKeyOf(articleId));
  if (legacy) {
    const percent = Number(legacy);
    const migrated: ArticleProgress = {
      ...EMPTY_PROGRESS,
      percent: Number.isFinite(percent) ? Math.min(99, Math.max(0, percent)) : 0,
      completed: percent >= 100,
      updatedAt: Date.now(),
    };
    if (migrated.completed) migrated.percent = 100;
    localStorage.setItem(keyOf(articleId), JSON.stringify(migrated));
    localStorage.removeItem(legacyKeyOf(articleId));
    return migrated;
  }

  return EMPTY_PROGRESS;
}

export function saveProgress(articleId: string, progress: Partial<ArticleProgress>) {
  if (typeof window === "undefined") return;
  const current = loadProgress(articleId);
  const next: ArticleProgress = { ...current, ...progress, updatedAt: Date.now() };
  if (!next.completed) next.percent = Math.min(99, next.percent);
  localStorage.setItem(keyOf(articleId), JSON.stringify(next));
}
