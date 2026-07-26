import type { Article } from "@/lib/seed-data";
import type { GeneratedCourseResponse, PersistGeneratedCourseResponse } from "@/lib/api";

export interface StoredGeneratedCourse {
  id: string;
  name: string;
  createdAt: number;
  course: GeneratedCourseResponse;
  persisted: PersistGeneratedCourseResponse | null;
}

const KEY = "wordscape:generated-courses";
const LEGACY_KEY = "wordscape:generated-course";

function migrateLegacy() {
  if (localStorage.getItem(KEY)) return;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return;

  try {
    const parsed = JSON.parse(legacy) as GeneratedCourseResponse & { persisted?: PersistGeneratedCourseResponse };
    const stored: StoredGeneratedCourse = {
      id: "legacy-1",
      name: parsed.course_title || "我的生成课程",
      createdAt: Date.now(),
      course: parsed,
      persisted: parsed.persisted ?? null,
    };
    localStorage.setItem(KEY, JSON.stringify([stored]));
  } catch {
    // 旧数据损坏则放弃迁移
  }
  localStorage.removeItem(LEGACY_KEY);
}

export function loadGeneratedCourses(): StoredGeneratedCourse[] {
  if (typeof window === "undefined") return [];
  migrateLegacy();

  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as StoredGeneratedCourse[]) : [];
  } catch {
    return [];
  }
}

export function getGeneratedCourse(id: string): StoredGeneratedCourse | null {
  return loadGeneratedCourses().find((item) => item.id === id) ?? null;
}

function persist(items: StoredGeneratedCourse[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("wordscape:generated-courses-changed"));
}

export function addGeneratedCourse(
  name: string,
  course: GeneratedCourseResponse,
  persisted: PersistGeneratedCourseResponse | null,
): StoredGeneratedCourse {
  const stored: StoredGeneratedCourse = {
    id: `gc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || course.course_title || "我的生成课程",
    createdAt: Date.now(),
    course,
    persisted,
  };
  persist([stored, ...loadGeneratedCourses()]);
  return stored;
}

export function updateGeneratedCourse(id: string, patch: Partial<Pick<StoredGeneratedCourse, "name" | "course" | "persisted">>) {
  persist(loadGeneratedCourses().map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

export function deleteGeneratedCourse(id: string) {
  persist(loadGeneratedCourses().filter((item) => item.id !== id));
}

export function toReaderArticle(stored: StoredGeneratedCourse, articleIndex: number): Article | null {
  const article = stored.course.articles.find((item) => item.index === articleIndex);
  if (!article) return null;

  return {
    id: `generated-${stored.id}-${article.index}`,
    courseId: stored.id,
    index: article.index,
    title: article.title,
    topic: article.topic,
    targetWordCount: article.target_word_count,
    readingMinutes: Math.max(1, Math.ceil(article.word_count / 180)),
    status: "unread",
    progress: 0,
    isFree: true,
    paragraphs: article.paragraphs.map((paragraph) => ({
      id: paragraph.id,
      sentences: paragraph.sentences.map((sentence) => ({
        id: sentence.id,
        en: sentence.en,
        zh: sentence.zh,
        targetWords: sentence.target_words,
      })),
    })),
  };
}
