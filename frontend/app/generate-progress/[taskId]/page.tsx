"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import {
  apiGet,
  apiPost,
  type PersistGeneratedCourseResponse,
  type TaskStatusResponse,
} from "@/lib/api";
import { addGeneratedCourse } from "@/lib/generated-course";
import { clearActiveGeneration, getSavedCourseId, markCourseSaved } from "@/lib/generation-task";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface GenerateProgressPageProps {
  params: Promise<{ taskId: string }>;
}

export default function GenerateProgressPage({ params }: GenerateProgressPageProps) {
  const { taskId } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedCourseId, setSavedCourseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // 轮询任务状态
  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      try {
        const next = await apiGet<TaskStatusResponse>(`/api/generate/tasks/${taskId}`);
        if (stopped) return;
        setStatus(next);
        setLoadError(null);
        if (next.status === "pending" || next.status === "running") {
          timer = setTimeout(poll, 2000);
        }
      } catch (error) {
        if (stopped) return;
        setLoadError(error instanceof Error ? error.message : "查询任务失败");
      }
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    void poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [taskId]);

  // 完成且无失败：自动保存课程并跳转
  useEffect(() => {
    if (!status || status.status !== "done" || status.failed_articles > 0 || !status.result) return;
    if (savingRef.current) return;

    savingRef.current = true;
    const result = status.result;
    const courseTitle = status.course_title;

    const save = async () => {
      const existing = getSavedCourseId(taskId);
      if (existing) {
        clearActiveGeneration(taskId);
        setSavedCourseId(existing);
        return;
      }

      setSaving(true);
      let persisted: PersistGeneratedCourseResponse | null = null;
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: auth } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
        persisted = await apiPost<PersistGeneratedCourseResponse>("/api/persist/generated-course", {
          user_id: auth.user?.id ?? null,
          vocab_set_name: courseTitle,
          source_words: [],
          generated_course: result,
        });
      } catch {
        // Supabase 持久化失败不阻塞本地保存
      }

      const stored = addGeneratedCourse(courseTitle, result, persisted);
      markCourseSaved(taskId, stored.id);
      clearActiveGeneration(taskId);
      setSavedCourseId(stored.id);
      setSaving(false);
    };

    void save();
  }, [status, taskId]);

  // 保存完成后自动跳转
  useEffect(() => {
    if (!savedCourseId) return;
    const timer = setTimeout(() => router.push(`/generated-course/${savedCourseId}`), 1500);
    return () => clearTimeout(timer);
  }, [savedCourseId, router]);

  const retryFailed = async () => {
    try {
      await apiPost<TaskStatusResponse>(`/api/generate/tasks/${taskId}/retry`, {});
      // 刷新页面以重新进入轮询循环
      window.location.reload();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "重试失败");
    }
  };

  if (loadError && !status) {
    return (
      <main className="min-h-screen bg-[var(--neutral-50)] px-5 py-8">
        <section className="mx-auto max-w-xl rounded-lg bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[var(--neutral-900)]">找不到这个生成任务</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--neutral-700)]">{loadError}</p>
          <Link href="/library/new" className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary-800)] px-5 text-sm font-semibold text-white">
            <ArrowLeft size={17} />
            返回词库导入
          </Link>
        </section>
      </main>
    );
  }

  if (!status) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--neutral-50)]">
        <Loader2 className="animate-spin text-[var(--primary-800)]" size={28} />
      </main>
    );
  }

  const percent = status.total_articles === 0 ? 0 : Math.round((status.completed_articles / status.total_articles) * 100);
  const running = status.status === "pending" || status.status === "running";

  return (
    <main className="min-h-screen bg-[var(--neutral-50)] px-5 py-5">
      <div className="mx-auto max-w-3xl">
        <Link href="/generated-course" className="mb-5 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm text-[var(--neutral-700)] shadow-sm">
          <ArrowLeft size={17} />
          我的生成课程
        </Link>

        <section className="rounded-lg bg-[var(--primary-800)] p-5 text-white">
          <div className="text-sm text-white/70">课程生成任务</div>
          <h1 className="mt-1 text-3xl font-bold">{status.course_title}</h1>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-white/80">
              {running
                ? `正在生成第 ${status.current_index ?? "…"} 篇`
                : status.status === "done"
                  ? status.failed_articles > 0
                    ? `完成，但有 ${status.failed_articles} 篇失败`
                    : "全部生成完成"
                  : "任务失败"}
            </span>
            <span className="font-semibold">
              {status.completed_articles}/{status.total_articles} 篇
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-[var(--accent-400)] transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
          {running && <p className="mt-3 text-xs text-white/65">生成期间可以离开本页，回来时进度还在。任务在后台继续执行。</p>}
        </section>

        {status.status === "failed" && (
          <section className="mt-5 rounded-lg border border-red-200 bg-red-50 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <XCircle size={17} />
              生成失败
            </div>
            <p className="mt-2 text-sm leading-7 text-red-700">{status.error ?? "请检查模型配置后重试。"}</p>
            <div className="mt-4 flex gap-3">
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white" onClick={retryFailed} type="button">
                <RefreshCw size={15} />
                重试
              </button>
              <Link href="/settings/model" className="inline-flex h-10 items-center rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700">
                检查模型配置
              </Link>
            </div>
          </section>
        )}

        {status.status === "done" && status.failed_articles > 0 && (
          <section className="mt-5 rounded-lg border border-[var(--accent-200)] bg-[#FFF8EF] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-600)]">
              <AlertTriangle size={17} />
              有 {status.failed_articles} 篇生成失败
            </div>
            <p className="mt-2 text-sm leading-7 text-[var(--neutral-700)]">可以重试失败篇目，或先保存已完成的 {status.completed_articles} 篇开始学习。</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--primary-800)] px-4 text-sm font-semibold text-white" onClick={retryFailed} type="button">
                <RefreshCw size={15} />
                重试失败篇目
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--neutral-200)] bg-white px-4 text-sm font-semibold text-[var(--neutral-700)] disabled:opacity-60"
                onClick={() => {
                  if (!status.result) return;
                  const stored = addGeneratedCourse(status.course_title, status.result, null);
                  markCourseSaved(taskId, stored.id);
                  clearActiveGeneration(taskId);
                  router.push(`/generated-course/${stored.id}`);
                }}
                disabled={!status.result || Boolean(getSavedCourseId(taskId))}
                type="button"
              >
                保存已完成的 {status.completed_articles} 篇
              </button>
            </div>
          </section>
        )}

        {savedCourseId && (
          <section className="mt-5 rounded-lg border border-[var(--primary-100)] bg-[#F0FAF2] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--primary-700)]">
              <CheckCircle2 size={17} />
              {saving ? "正在保存课程..." : "课程已保存，即将进入课程页"}
            </div>
            <Link href={`/generated-course/${savedCourseId}`} className="mt-3 inline-flex h-10 items-center rounded-lg bg-[var(--primary-800)] px-4 text-sm font-semibold text-white">
              立即进入课程
            </Link>
          </section>
        )}

        <section className="mt-5 grid gap-2">
          {status.articles.map((article) => (
            <div
              key={article.index}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-white p-3",
                article.status === "generating" ? "border-[var(--primary-700)]" : "border-[var(--neutral-200)]",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  article.status === "done" && "bg-[var(--primary-100)] text-[var(--primary-800)]",
                  article.status === "generating" && "bg-[var(--primary-800)] text-white",
                  article.status === "failed" && "bg-red-100 text-red-600",
                  article.status === "pending" && "bg-[var(--neutral-100)] text-[var(--neutral-400)]",
                )}
              >
                {article.status === "done" ? (
                  <CheckCircle2 size={15} />
                ) : article.status === "generating" ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : article.status === "failed" ? (
                  <XCircle size={15} />
                ) : (
                  String(article.index).padStart(2, "0")
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-[var(--neutral-900)]">{article.title ?? `第 ${article.index} 篇`}</span>
                  <span className="text-xs text-[var(--neutral-400)]">{article.topic}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--neutral-400)]">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen size={12} />
                    {article.target_word_count} 个目标词
                  </span>
                  {article.error && <span className="truncate text-red-500">{article.error}</span>}
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
