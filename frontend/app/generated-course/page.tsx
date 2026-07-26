"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, FilePlus2, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteGeneratedCourse, loadGeneratedCourses, type StoredGeneratedCourse } from "@/lib/generated-course";
import { loadActiveGeneration } from "@/lib/generation-task";
import { GENERATED_COURSE_EVENTS, NO_EVENTS, useClientValue } from "@/lib/use-client-value";

const EMPTY_COURSES: StoredGeneratedCourse[] = [];

export default function GeneratedCourseListPage() {
  const courses = useClientValue(loadGeneratedCourses, EMPTY_COURSES, GENERATED_COURSE_EVENTS);
  const activeGeneration = useClientValue(loadActiveGeneration, null, NO_EVENTS);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const removeCourse = (id: string) => {
    deleteGeneratedCourse(id);
    setConfirmingId(null);
  };

  return (
    <main className="min-h-screen bg-[var(--neutral-50)] px-5 py-5">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm text-[var(--neutral-700)] shadow-sm">
            <ArrowLeft size={17} />
            返回首页
          </Link>
          <Link href="/library/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm text-[var(--neutral-700)] shadow-sm">
            <FilePlus2 size={17} />
            新建词库
          </Link>
        </div>

        <section className="rounded-lg bg-[var(--primary-800)] p-5 text-white">
          <div className="text-sm text-white/70">自定义生成</div>
          <h1 className="mt-1 text-3xl font-bold">我的生成课程</h1>
          <p className="mt-2 text-sm text-white/75">共 {courses.length} 套课程，全部由你的词库 AI 生成。</p>
        </section>

        {activeGeneration && (
          <Link
            href={`/generate-progress/${activeGeneration.taskId}`}
            className="mt-5 flex items-center gap-3 rounded-lg border border-[var(--accent-200)] bg-[#FFF8EF] p-4 transition hover:border-[var(--accent-400)]"
          >
            <Loader2 className="animate-spin text-[var(--accent-600)]" size={18} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--neutral-900)]">「{activeGeneration.name}」正在生成中</div>
              <div className="text-xs text-[var(--neutral-400)]">点击查看实时进度</div>
            </div>
          </Link>
        )}

        {courses.length === 0 ? (
          <section className="mt-5 rounded-lg bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-[var(--neutral-900)]">还没有生成课程</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--neutral-700)]">先创建一个自定义词库，生成完成后会出现在这里。</p>
            <Link href="/library/new" className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary-800)] px-5 text-sm font-semibold text-white">
              <FilePlus2 size={17} />
              新建词库
            </Link>
          </section>
        ) : (
          <section className="mt-5 grid gap-3">
            {courses.map((stored) => (
              <div key={stored.id} className="rounded-lg border border-[var(--neutral-200)] bg-white p-4 transition hover:border-[var(--primary-700)]">
                <div className="flex items-start gap-4">
                  <Link href={`/generated-course/${stored.id}`} className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-[var(--neutral-900)]">{stored.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--neutral-400)]">
                      <span className="inline-flex items-center gap-1">
                        <BookOpen size={13} />
                        {stored.course.total_articles} 篇文章
                      </span>
                      <span>{stored.course.total_words} 个词</span>
                      <span>{new Date(stored.createdAt).toLocaleDateString("zh-CN")}</span>
                    </div>
                  </Link>
                  <button
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--neutral-100)] text-[var(--neutral-400)] transition hover:text-red-500"
                    onClick={() => setConfirmingId(stored.id)}
                    type="button"
                    aria-label={`删除课程 ${stored.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {confirmingId === stored.id && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm">
                    <span className="text-red-700">删除后无法恢复，确认删除这套课程？</span>
                    <div className="flex shrink-0 gap-2">
                      <button className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white" onClick={() => removeCourse(stored.id)} type="button">
                        确认删除
                      </button>
                      <button className="rounded-full border border-[var(--neutral-200)] bg-white px-3 py-1.5 text-xs" onClick={() => setConfirmingId(null)} type="button">
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
