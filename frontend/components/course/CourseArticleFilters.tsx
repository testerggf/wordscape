"use client";

import { useMemo, useState } from "react";
import { ArticleCard, type ArticleSummary } from "@/components/course/ArticleCard";
import { cn } from "@/lib/utils";

interface CourseArticleFiltersProps {
  topics: string[];
  articles: ArticleSummary[];
}

const ALL_TOPICS = "全部";

export function CourseArticleFilters({ topics, articles }: CourseArticleFiltersProps) {
  const [activeTopic, setActiveTopic] = useState(ALL_TOPICS);

  const filteredArticles = useMemo(() => {
    if (activeTopic === ALL_TOPICS) return articles;
    return articles.filter((article) => article.topic === activeTopic);
  }, [activeTopic, articles]);

  return (
    <>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {[ALL_TOPICS, ...topics].map((topic) => {
          const selected = topic === activeTopic;

          return (
            <button
              key={topic}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition",
                selected
                  ? "border-[var(--primary-800)] bg-[var(--primary-800)] text-white"
                  : "border-[var(--neutral-200)] bg-white text-[var(--neutral-700)] hover:border-[var(--primary-700)]",
              )}
              onClick={() => setActiveTopic(topic)}
              type="button"
              aria-pressed={selected}
            >
              {topic}
            </button>
          );
        })}
      </div>

      <section className="mt-3 grid gap-3">
        {filteredArticles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </section>
    </>
  );
}
