"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { use } from "react";
import { ReaderView } from "@/components/reader/ReaderView";
import { getGeneratedCourse, toReaderArticle } from "@/lib/generated-course";
import { NO_EVENTS, useClientValue } from "@/lib/use-client-value";

interface GeneratedReadPageProps {
  params: Promise<{ courseId: string; articleIndex: string }>;
}

export default function GeneratedReadPage({ params }: GeneratedReadPageProps) {
  const { courseId, articleIndex } = use(params);
  const article = useClientValue(() => {
    const stored = getGeneratedCourse(courseId);
    if (!stored) return null;
    return toReaderArticle(stored, Number(articleIndex));
  }, null, NO_EVENTS);

  if (!article) {
    return (
      <main className="min-h-screen bg-[var(--neutral-50)] px-5 py-8">
        <section className="mx-auto max-w-xl rounded-lg bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[var(--neutral-900)]">没有找到这篇生成文章</h1>
          <Link href="/generated-course" className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary-800)] px-5 text-sm font-semibold text-white">
            <ArrowLeft size={17} />
            返回生成课程
          </Link>
        </section>
      </main>
    );
  }

  return <ReaderView article={article} backHref={`/generated-course/${courseId}`} />;
}
