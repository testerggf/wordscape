import type { Article, Course, Paragraph, ReadingStatus } from "@/lib/seed-data";
import type { Json } from "@/types/database";

interface SupabaseCourseRow {
  id: string;
  title: string;
  total_articles: number;
  articles?: SupabaseArticleRow[];
}

interface SupabaseArticleRow {
  id: string;
  course_id: string;
  index: number;
  title: string;
  topic: string;
  content: Json;
  target_word_count: number;
  word_count: number;
  is_free: boolean;
}

interface ArticleContent {
  paragraphs: Paragraph[];
}

export function toCourse(row: SupabaseCourseRow): Course {
  const articles = (row.articles ?? [])
    .slice()
    .sort((a, b) => a.index - b.index)
    .map(toArticle);

  return {
    id: row.id,
    title: row.title,
    subtitle: `${row.total_articles} 篇精读文章`,
    totalArticles: row.total_articles,
    completedArticles: 0,
    masteredWords: articles.reduce((sum, article) => sum + article.targetWordCount, 0),
    articles,
  };
}

export function toArticle(row: SupabaseArticleRow): Article {
  const content = normalizeContent(row.content);
  const status: ReadingStatus = row.is_free ? "unread" : "locked";

  return {
    id: row.id,
    courseId: row.course_id,
    index: row.index,
    title: row.title,
    topic: row.topic,
    targetWordCount: row.target_word_count,
    readingMinutes: Math.max(1, Math.ceil(row.word_count / 180)),
    status,
    progress: 0,
    isFree: row.is_free,
    paragraphs: content.paragraphs,
  };
}

function normalizeContent(content: Json): ArticleContent {
  if (
    content
    && typeof content === "object"
    && !Array.isArray(content)
    && Array.isArray(content.paragraphs)
  ) {
    return content as unknown as ArticleContent;
  }

  return { paragraphs: [] };
}
