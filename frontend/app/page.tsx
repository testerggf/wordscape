import Link from "next/link";
import { ArrowRight, BookOpen, FilePlus2, Settings, Sparkles } from "lucide-react";
import { QuickLinks } from "@/components/home/QuickLinks";
import { getConfiguredBuiltinCourses } from "@/lib/builtin-data";

export default async function Home() {
  const courses = await getConfiguredBuiltinCourses();
  const firstCourse = courses[0];

  return (
    <main className="min-h-screen bg-[var(--neutral-50)]">
      <section className="bg-[var(--primary-800)] px-5 py-10 text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
              <Sparkles size={15} />
              WordScape
            </div>
            <h1 className="max-w-2xl font-serif text-4xl font-bold leading-tight md:text-5xl">
              输入词汇表，AI 生成故事，读完就记住。
            </h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-white/75">
              从小学到职场的内置词库开箱即用，也可以导入任意词汇表，生成专属精读课程。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/courses/${firstCourse.id}`}
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="flex flex-col rounded-lg border border-[var(--neutral-200)] bg-white p-5 transition hover:border-[var(--primary-700)] hover:shadow-sm"
            >
              <h2 className="text-lg font-bold text-[var(--neutral-900)]">{course.title}</h2>
              <p className="mt-1 flex-1 text-sm leading-6 text-[var(--neutral-700)]">{course.subtitle}</p>
              <div className="mt-4 flex items-center gap-4 text-xs text-[var(--neutral-400)]">
                <span className="font-semibold text-[var(--primary-800)]">{course.totalArticles} 篇文章</span>
                <span>{course.masteredWords} 个词汇</span>
                <span>前 5 篇免费</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-5">
          <QuickLinks />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
