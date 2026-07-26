import rawCourse from "@/data/builtin-course.json";
import { courses as seedCourses, type Article, type Course } from "@/lib/seed-data";

/** 课程 JSON 的原始结构（generate_builtin_course.py 输出的 course 字段） */
interface RawBuiltinCourse {
  course_title?: string;
  total_words?: number;
  total_articles?: number;
  articles?: Array<{
    index: number;
    title: string;
    topic: string;
    topic_en: string;
    paragraphs: Array<{
      id: number;
      sentences: Array<{ id: string; en: string; zh: string; target_words: string[] }>;
    }>;
    target_word_count: number;
    word_count: number;
    quality?: { passed: boolean; issues: string[]; coverage: number };
  }>;
}

const FREE_ARTICLES = 5;
const COURSE_ID = "cet4";

function convert(raw: RawBuiltinCourse): Course | null {
  if (!raw.articles || raw.articles.length === 0) return null;

  const articles: Article[] = raw.articles.map((article) => ({
    id: `${COURSE_ID}-${String(article.index).padStart(3, "0")}`,
    courseId: COURSE_ID,
    index: article.index,
    title: article.title,
    topic: article.topic,
    targetWordCount: article.target_word_count,
    readingMinutes: Math.max(1, Math.ceil(article.word_count / 180)),
    status: article.index <= FREE_ARTICLES ? "unread" : "locked",
    progress: 0,
    isFree: article.index <= FREE_ARTICLES,
    paragraphs: article.paragraphs.map((paragraph) => ({
      id: paragraph.id,
      sentences: paragraph.sentences.map((sentence) => ({
        id: sentence.id,
        en: sentence.en,
        zh: sentence.zh,
        targetWords: sentence.target_words,
      })),
    })),
  }));

  return {
    id: COURSE_ID,
    title: raw.course_title ?? "大学英语四级",
    subtitle: `${articles.length} 篇故事覆盖核心四级词汇`,
    totalArticles: articles.length,
    completedArticles: 0,
    masteredWords: raw.total_words ?? articles.reduce((sum, item) => sum + item.targetWordCount, 0),
    articles,
  };
}

// 真实生成内容存在时使用之，否则回退到本地种子数据
const builtinCourse: Course = convert(rawCourse as RawBuiltinCourse) ?? seedCourses[0];

export function getBuiltinCourse(): Course {
  return builtinCourse;
}

export function getBuiltinArticle(articleId: string): Article | undefined {
  return builtinCourse.articles.find((article) => article.id === articleId);
}
