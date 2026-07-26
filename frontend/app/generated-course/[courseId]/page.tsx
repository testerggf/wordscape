"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react";
import { use } from "react";
import { getGeneratedCourse } from "@/lib/generated-course";
import { GENERATED_COURSE_EVENTS, useClientValue } from "@/lib/use-client-value";

interface GeneratedCourseDetailProps {
  params: Promise<{ courseId: string }>;
}

export default function GeneratedCourseDetailPage({ params }: GeneratedCourseDetailProps) {
  const { courseId } = use(params);
  const stored = useClientValue(() => getGeneratedCourse(courseId), null, GENERATED_COURSE_EVENTS);

  if (!stored) {
    return (
      <main className="min-h-screen bg-[var(--neutral-50)] px-5 py-8">
        <section className="mx-auto max-w-xl rounded-lg bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[var(--neutral-900)]">没有找到这套课程</h1>
          <Link href="/generated-course" className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary-800)] px-5 text-sm font-semibold text-white">
            <ArrowLeft size={17} />
            返回课程列表
          </Link>
        </section>
      </main>
    );
  }

  const course = stored.course;

  return (
    <main className="min-h-screen bg-[var(--neutral-50)] px-5 py-5">
      <div className="mx-auto max-w-4xl">
        <Link href="/generated-course" className="mb-5 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm text-[var(--neutral-700)] shadow-sm">
          <ArrowLeft size={17} />
          我的生成课程
        </Link>

        <section className="rounded-lg bg-[var(--primary-800)] p-5 text-white">
          <div className="text-sm text-white/70">自定义生成课程</div>
          <h1 className="mt-1 text-3xl font-bold">{stored.name}</h1>
          <p className="mt-2 text-sm text-white/75">共 {course.total_words} 个有效词，生成 {course.total_articles} 篇文章。</p>
        </section>

        <section className="mt-5 grid gap-3">
          {course.articles.map((article) => (
            <Link
              key={article.index}
              href={`/generated-read/${stored.id}/${article.index}`}
              className="flex gap-4 rounded-lg border border-[var(--neutral-200)] bg-white p-4 transition hover:border-[var(--primary-700)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-100)] text-sm font-bold text-[var(--primary-800)]">
                {String(article.index).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-xs font-semibold text-[var(--primary-700)]">{article.topic}</div>
                <h2 className="text-base font-semibold leading-snug text-[var(--neutral-900)]">{article.title}</h2>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--neutral-400)]">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen size={13} />
                    {article.target_word_count} 个目标词
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    覆盖率 {Math.round(article.quality.coverage * 100)}%
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
