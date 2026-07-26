"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, FilePlus2 } from "lucide-react";
import { useState } from "react";
import { loadGeneratedCourse } from "@/lib/generated-course";
import type { GeneratedCourseResponse } from "@/lib/api";

export default function GeneratedCoursePage() {
  const [course] = useState<GeneratedCourseResponse | null>(() => loadGeneratedCourse());

  if (!course) {
    return (
      <main className="min-h-screen bg-[var(--neutral-50)] px-5 py-8">
        <section className="mx-auto max-w-xl rounded-lg bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[var(--neutral-900)]">还没有生成课程</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--neutral-700)]">先创建一个自定义词库，生成完成后会自动进入这里。</p>
          <Link href="/library/new" className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary-800)] px-5 text-sm font-semibold text-white">
            <FilePlus2 size={17} />
            新建词库
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--neutral-50)] px-5 py-5">
      <div className="mx-auto max-w-4xl">
        <Link href="/library/new" className="mb-5 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm text-[var(--neutral-700)] shadow-sm">
          <ArrowLeft size={17} />
          返回导入
        </Link>

        <section className="rounded-lg bg-[var(--primary-800)] p-5 text-white">
          <div className="text-sm text-white/70">自定义生成课程</div>
          <h1 className="mt-1 text-3xl font-bold">{course.course_title}</h1>
          <p className="mt-2 text-sm text-white/75">共 {course.total_words} 个有效词，生成 {course.total_articles} 篇文章。</p>
        </section>

        <section className="mt-5 grid gap-3">
          {course.articles.map((article) => (
            <Link
              key={article.index}
              href={`/generated-read/${article.index}`}
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
