"use client";

import Link from "next/link";
import { BookMarked, Layers } from "lucide-react";
import { loadGeneratedCourses } from "@/lib/generated-course";
import { loadWordbook } from "@/lib/wordbook";
import { GENERATED_COURSE_EVENTS, WORDBOOK_EVENTS, useClientValue } from "@/lib/use-client-value";

export function QuickLinks() {
  const wordCount = useClientValue(() => loadWordbook().length, 0, WORDBOOK_EVENTS);
  const courseCount = useClientValue(() => loadGeneratedCourses().length, 0, GENERATED_COURSE_EVENTS);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Link
        href="/wordbook"
        className="flex items-center justify-between rounded-lg border border-[var(--neutral-200)] bg-white p-4 transition hover:border-[var(--primary-700)]"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-100)] text-[var(--primary-800)]">
            <BookMarked size={18} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-[var(--neutral-900)]">生词本</span>
            <span className="block text-xs text-[var(--neutral-400)]">收藏的词汇与语境</span>
          </span>
        </span>
        <span className="text-xl font-bold text-[var(--primary-800)]">{wordCount}</span>
      </Link>

      <Link
        href="/generated-course"
        className="flex items-center justify-between rounded-lg border border-[var(--neutral-200)] bg-white p-4 transition hover:border-[var(--primary-700)]"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-100)] text-[var(--primary-800)]">
            <Layers size={18} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-[var(--neutral-900)]">我的生成课程</span>
            <span className="block text-xs text-[var(--neutral-400)]">自定义词库生成的课程</span>
          </span>
        </span>
        <span className="text-xl font-bold text-[var(--primary-800)]">{courseCount}</span>
      </Link>
    </div>
  );
}
