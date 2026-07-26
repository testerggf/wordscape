import businessJson from "@/data/courses/business.json";
import cet4Json from "@/data/courses/cet4.json";
import cet6Json from "@/data/courses/cet6.json";
import dailyJson from "@/data/courses/daily.json";
import juniorJson from "@/data/courses/junior.json";
import primaryJson from "@/data/courses/primary.json";
import seniorJson from "@/data/courses/senior.json";
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

interface BuiltinCourseMeta {
  id: string;
  title: string;
  subtitle: string;
  raw: RawBuiltinCourse;
}

const COURSE_SOURCES: BuiltinCourseMeta[] = [
  { id: "primary", title: "小学英语词汇", subtitle: "小学大纲核心词，轻松起步", raw: primaryJson as RawBuiltinCourse },
  { id: "junior", title: "初中英语词汇", subtitle: "中考大纲词汇，故事化打牢基础", raw: juniorJson as RawBuiltinCourse },
  { id: "senior", title: "高中英语词汇", subtitle: "高考大纲词汇，阅读中系统掌握", raw: seniorJson as RawBuiltinCourse },
  { id: "cet4", title: "大学英语四级", subtitle: "覆盖核心四级词汇的故事课程", raw: cet4Json as RawBuiltinCourse },
  { id: "cet6", title: "大学英语六级核心", subtitle: "六级核心词汇，进阶提升", raw: cet6Json as RawBuiltinCourse },
  { id: "daily", title: "日常高频词汇", subtitle: "COCA 语料库高频词，实用日常表达", raw: dailyJson as RawBuiltinCourse },
  { id: "business", title: "职场商务英语", subtitle: "BEC 商务词汇，职场沟通无障碍", raw: businessJson as RawBuiltinCourse },
];

function convert(meta: BuiltinCourseMeta): Course | null {
  const raw = meta.raw;
  if (!raw.articles || raw.articles.length === 0) return null;

  const articles: Article[] = raw.articles.map((article) => ({
    id: `${meta.id}-${String(article.index).padStart(3, "0")}`,
    courseId: meta.id,
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
    id: meta.id,
    title: meta.title,
    subtitle: meta.subtitle,
    totalArticles: articles.length,
    completedArticles: 0,
    masteredWords: raw.total_words ?? articles.reduce((sum, item) => sum + item.targetWordCount, 0),
    articles,
  };
}

const converted = COURSE_SOURCES.map(convert).filter((course): course is Course => course !== null);

// 一套真实课程都没有时，回退到本地种子数据保证可演示
const builtinCourses: Course[] = converted.length > 0 ? converted : [seedCourses[0]];

export function getBuiltinCourses(): Course[] {
  return builtinCourses;
}

export function getBuiltinCourse(courseId: string): Course | undefined {
  return builtinCourses.find((course) => course.id === courseId);
}

export function getBuiltinArticle(articleId: string): Article | undefined {
  const splitAt = articleId.lastIndexOf("-");
  if (splitAt === -1) return undefined;
  const courseId = articleId.slice(0, splitAt);
  return getBuiltinCourse(courseId)?.articles.find((article) => article.id === articleId);
}
