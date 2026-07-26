import Link from "next/link";
import { ArrowRight, BookOpen, FilePlus2, Settings, Sparkles } from "lucide-react";
import { courses } from "@/lib/seed-data";

export default function Home() {
  const course = courses[0];

  return (
    <main className="min-h-screen bg-[var(--neutral-50)]">
      <section className="bg-[var(--primary-800)] px-5 py-10 text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
              <Sparkles size={15} />
              WordScape MVP
            </div>
            <h1 className="max-w-2xl font-serif text-4xl font-bold leading-tight md:text-5xl">
              输入词汇表，AI 生成故事，读完就记住。
            </h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-white/75">
              当前先实现本地 CET-4 阅读 MVP，用真实交互验证阅读器、高亮词和词典卡片体验。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/courses/${course.id}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-[var(--primary-900)]"
            >
              开始学习
              <ArrowRight size={17} />
            </Link>
            <Link
              href="/library/new"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/25"
            >
              自定义生成
              <FilePlus2 size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--neutral-700)]">
          <BookOpen size={17} />
          内置词库
        </div>
        <Link
          href={`/courses/${course.id}`}
          className="block rounded-lg border border-[var(--neutral-200)] bg-white p-5 transition hover:border-[var(--primary-700)]"
        >
          <div className="text-sm font-semibold text-[var(--primary-700)]">官方示例</div>
          <h2 className="mt-2 text-2xl font-bold text-[var(--neutral-900)]">{course.title}</h2>
          <p className="mt-2 text-sm text-[var(--neutral-700)]">{course.subtitle}</p>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-[var(--neutral-100)] p-3">
              <div className="text-xl font-bold">{course.totalArticles}</div>
              <div className="text-xs text-[var(--neutral-400)]">计划篇数</div>
            </div>
            <div className="rounded-lg bg-[var(--neutral-100)] p-3">
              <div className="text-xl font-bold">{course.completedArticles}</div>
              <div className="text-xs text-[var(--neutral-400)]">已读篇数</div>
            </div>
            <div className="rounded-lg bg-[var(--neutral-100)] p-3">
              <div className="text-xl font-bold">{course.masteredWords}</div>
              <div className="text-xs text-[var(--neutral-400)]">接触词汇</div>
            </div>
          </div>
        </Link>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link href="/library/new" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[var(--primary-800)] px-5 text-sm font-semibold text-white">
            <FilePlus2 size={17} />
            导入词汇生成课程
          </Link>
          <Link href="/settings/model" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[var(--primary-800)] px-5 text-sm font-semibold text-[var(--primary-800)]">
            <Settings size={17} />
            配置 AI 模型
          </Link>
        </div>
      </section>
    </main>
  );
}
