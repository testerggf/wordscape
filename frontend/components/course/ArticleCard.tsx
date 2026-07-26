"use client";

import Link from "next/link";
import { Check, Lock, X } from "lucide-react";
import { useState } from "react";
import { loadProgress } from "@/lib/reading-progress";
import { NO_EVENTS, useClientValue } from "@/lib/use-client-value";
import { cn } from "@/lib/utils";
import type { Article, ReadingStatus } from "@/lib/seed-data";

/** 列表页只需要元信息，不携带全文段落 */
export type ArticleSummary = Omit<Article, "paragraphs">;

interface ArticleCardProps {
  article: ArticleSummary;
}

export function ArticleCard({ article: seedArticle }: ArticleCardProps) {
  const [paywallOpen, setPaywallOpen] = useState(false);

  // 本地真实进度覆盖种子数据的演示状态（服务端渲染时为 null）
  const localProgress = useClientValue(
    () => (seedArticle.status === "locked" ? null : loadProgress(seedArticle.id)),
    null,
    NO_EVENTS,
  );

  const article =
    localProgress && localProgress.updatedAt > 0
      ? {
          ...seedArticle,
          status: (localProgress.completed ? "done" : localProgress.percent > 0 ? "reading" : "unread") as ReadingStatus,
          progress: localProgress.completed ? 100 : localProgress.percent,
        }
      : seedArticle;
  const locked = article.status === "locked";

  const card = (
    <div
      className={cn(
        "group flex gap-4 rounded-lg border border-[var(--neutral-200)] bg-white p-4 transition",
        locked ? "opacity-60" : "hover:border-[var(--primary-700)] hover:shadow-sm",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          article.status === "done" && "bg-[var(--success)] text-white",
          article.status === "reading" && "bg-[var(--primary-100)] text-[var(--primary-800)]",
          article.status === "unread" && "border border-[var(--neutral-200)] bg-[var(--neutral-100)] text-[var(--neutral-400)]",
          locked && "bg-[var(--neutral-100)] text-[var(--neutral-400)]",
        )}
      >
        {article.status === "done" ? <Check size={18} /> : locked ? <Lock size={16} /> : String(article.index).padStart(2, "0")}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs font-semibold text-[var(--primary-700)]">{article.topic}</div>
        <h2 className="text-base font-semibold leading-snug text-[var(--neutral-900)]">{article.title}</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--neutral-400)]">
          <span>{article.targetWordCount} 个目标词</span>
          <span>{article.readingMinutes} 分钟</span>
          <span>{locked ? "会员解锁" : article.status === "done" ? "已完成" : article.status === "reading" ? `进行中 ${article.progress}%` : "未开始"}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--neutral-100)]">
          <div className="h-full rounded-full bg-[var(--primary-700)]" style={{ width: `${article.progress}%` }} />
        </div>
      </div>
    </div>
  );

  if (locked) {
    return (
      <>
        <button className="w-full text-left" onClick={() => setPaywallOpen(true)}>
          {card}
        </button>

        {paywallOpen && (
          <div className="fixed inset-0 z-50 bg-black/35 px-5" onClick={() => setPaywallOpen(false)}>
            <section
              className="mx-auto mt-28 max-w-sm rounded-xl bg-white p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-label="会员解锁"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[var(--primary-700)]">免费试读已结束</div>
                  <h2 className="mt-1 text-2xl font-bold text-[var(--neutral-900)]">解锁完整四级课程</h2>
                </div>
                <button className="rounded-full bg-[var(--neutral-100)] p-2 text-[var(--neutral-700)]" onClick={() => setPaywallOpen(false)} aria-label="关闭">
                  <X size={17} />
                </button>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--neutral-700)]">
                MVP 阶段先保留付费墙交互：前 5 篇免费，第 6 篇开始展示解锁提示。后续会接入真实会员状态和支付回调。
              </p>
              <button className="mt-5 w-full rounded-lg bg-[var(--primary-800)] py-3 text-sm font-semibold text-white">
                查看会员方案
              </button>
            </section>
          </div>
        )}
      </>
    );
  }

  return <Link href={`/read/${article.id}`}>{card}</Link>;
}
