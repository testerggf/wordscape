import type { Article } from "@/lib/seed-data";
import type { GeneratedCourseResponse } from "@/lib/api";

export function loadGeneratedCourse(): GeneratedCourseResponse | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem("wordscape:generated-course");
  if (!saved) return null;

  try {
    return JSON.parse(saved) as GeneratedCourseResponse;
  } catch {
    return null;
  }
}

export function toReaderArticle(course: GeneratedCourseResponse, articleIndex: number): Article | null {
  const article = course.articles.find((item) => item.index === articleIndex);
  if (!article) return null;

  return {
    id: `generated-${article.index}`,
    courseId: "generated",
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
