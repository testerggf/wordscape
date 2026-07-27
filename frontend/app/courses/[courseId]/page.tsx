import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { CourseArticleFilters } from "@/components/course/CourseArticleFilters";
import { getConfiguredBuiltinCourse } from "@/lib/builtin-data";

interface CoursePageProps {
  params: Promise<{ courseId: string }>;
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseId } = await params;
  const course = await getConfiguredBuiltinCourse(courseId);

  if (!course) {
    notFound();
  }

  const progress = Math.round((course.completedArticles / course.totalArticles) * 100);
  const topics = Array.from(new Set(course.articles.map((article) => article.topic)));
  // 列表页只传元信息，不携带全文段落（真实课程全文有数 MB）
  const articleSummaries = course.articles.map((article) => {
    const { paragraphs, ...summary } = article;
    void paragraphs;
    return summary;
  });

  return (
    <main className="min-h-screen bg-[var(--neutral-50)] px-5 py-5">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-5 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm text-[var(--neutral-700)] shadow-sm">
          <ArrowLeft size={17} />
          返回首页
        </Link>

        <section className="rounded-lg bg-[var(--primary-800)] p-5 text-white">
          <div className="text-sm text-white/70">当前课程</div>
          <h1 className="mt-1 text-3xl font-bold">{course.title}</h1>
          <p className="mt-2 text-sm text-white/75">{course.subtitle}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white/10 p-4">
              <div className="text-2xl font-bold">{progress}%</div>
              <div className="text-xs text-white/65">完成进度</div>
            </div>
            <div className="rounded-lg bg-white/10 p-4">
              <div className="text-2xl font-bold">
                {course.completedArticles}/{course.totalArticles}
              </div>
              <div className="text-xs text-white/65">已读篇章</div>
            </div>
            <div className="rounded-lg bg-white/10 p-4">
              <div className="text-2xl font-bold">{course.masteredWords}</div>
              <div className="text-xs text-white/65">接触目标词</div>
            </div>
          </div>
        </section>

        <CourseArticleFilters topics={topics} articles={articleSummaries} />
      </div>
    </main>
  );
}
