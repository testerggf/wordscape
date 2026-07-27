import type { Article, Course, Paragraph } from "@/lib/seed-data";
import { getBuiltinArticle, getBuiltinCourse, getBuiltinCourses } from "@/lib/builtin-course";

export type BuiltinDataSource = "local" | "supabase";

const SOURCE = (process.env.NEXT_PUBLIC_BUILTIN_DATA_SOURCE ?? "local") as BuiltinDataSource;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TIMEOUT_MS = 5000;

interface VocabSetRow {
  id: string;
  builtin_id: string;
  name: string;
  word_count: number;
  article_count: number;
}

interface ArticleRow {
  index: number;
  title: string;
  topic: string;
  content: { title_zh?: string; paragraphs?: Array<{
    id: number;
    sentences: Array<{ id: string; en: string; zh: string; target_words: string[] }>;
  }> };
  target_word_count: number;
  word_count: number;
  is_free: boolean;
}

async function supabaseGet<T>(path: string): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase 前端配置不完整");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Supabase 读取失败：${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchVocabSets(): Promise<VocabSetRow[]> {
  return supabaseGet<VocabSetRow[]>(
    "vocab_sets?select=id,builtin_id,name,word_count,article_count&source=eq.builtin&status=eq.ready",
  );
}

function remoteArticle(local: Article, row: ArticleRow): Article {
  const paragraphs: Paragraph[] = (row.content?.paragraphs ?? []).map((paragraph) => ({
    id: paragraph.id,
    sentences: paragraph.sentences.map((sentence) => ({
      id: sentence.id,
      en: sentence.en,
      zh: sentence.zh,
      targetWords: sentence.target_words,
    })),
  }));
  if (paragraphs.length === 0) throw new Error(`Supabase 文章 #${row.index} 正文为空`);
  return {
    ...local,
    title: row.title,
    titleZh: row.content.title_zh,
    topic: row.topic,
    targetWordCount: row.target_word_count,
    readingMinutes: Math.max(1, Math.ceil(row.word_count / 180)),
    isFree: row.is_free,
    status: row.is_free ? local.status : "locked",
    paragraphs,
  };
}

export function getBuiltinDataSource(): BuiltinDataSource {
  return SOURCE === "supabase" ? "supabase" : "local";
}

export async function getConfiguredBuiltinCourses(): Promise<Course[]> {
  const local = getBuiltinCourses();
  if (getBuiltinDataSource() === "local") return local;
  try {
    const rows = await fetchVocabSets();
    if (rows.length === 0) throw new Error("Supabase 没有内置词库");
    const byId = new Map(rows.map((row) => [row.builtin_id, row]));
    return local.map((course) => {
      const row = byId.get(course.id);
      return row ? {
        ...course,
        title: row.name,
        totalArticles: row.article_count,
        masteredWords: row.word_count,
      } : course;
    });
  } catch (error) {
    console.warn("[builtin-data] Supabase 课程列表读取失败，回退本地 JSON", error);
    return local;
  }
}

export async function getConfiguredBuiltinCourse(courseId: string): Promise<Course | undefined> {
  const local = getBuiltinCourse(courseId);
  if (!local || getBuiltinDataSource() === "local") return local;
  try {
    const sets = await supabaseGet<VocabSetRow[]>(
      `vocab_sets?select=id,builtin_id,name,word_count,article_count&builtin_id=eq.${encodeURIComponent(courseId)}&source=eq.builtin&limit=1`,
    );
    if (sets.length !== 1) throw new Error(`Supabase 未找到课程 ${courseId}`);
    const rows = await supabaseGet<ArticleRow[]>(
      `articles?select=index,title,topic,content,target_word_count,word_count,is_free&vocab_set_id=eq.${sets[0].id}&order=index`,
    );
    if (rows.length === 0) throw new Error(`Supabase 课程 ${courseId} 没有可读文章`);
    const byIndex = new Map(rows.map((row) => [row.index, row]));
    return {
      ...local,
      title: sets[0].name,
      totalArticles: sets[0].article_count,
      masteredWords: sets[0].word_count,
      articles: local.articles.map((article) => {
        const row = byIndex.get(article.index);
        return row ? remoteArticle(article, row) : article;
      }),
    };
  } catch (error) {
    console.warn(`[builtin-data] Supabase 课程 ${courseId} 读取失败，回退本地 JSON`, error);
    return local;
  }
}

export async function getConfiguredBuiltinArticle(articleId: string): Promise<Article | undefined> {
  const local = getBuiltinArticle(articleId);
  if (!local || getBuiltinDataSource() === "local") return local;
  const course = await getConfiguredBuiltinCourse(local.courseId);
  return course?.articles.find((article) => article.id === articleId) ?? local;
}
