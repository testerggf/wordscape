"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, FileText, Loader2, Play, RefreshCw, Settings, Sparkles, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  apiPost,
  loadModelConfig,
  type PreviewArticleResponse,
  type StartCourseResponse,
  type VocabPreviewResponse,
} from "@/lib/api";
import { saveActiveGeneration } from "@/lib/generation-task";

const SAMPLE_WORDS = `academic
deadline
robot
therapy
journey
proposal
research
campus
routine
technology`;

type LoadingState = "preview" | "trial" | "start" | null;

export default function NewLibraryPage() {
  const router = useRouter();
  const [name, setName] = useState("我的测试词库");
  const [rawText, setRawText] = useState(SAMPLE_WORDS);
  const [preview, setPreview] = useState<VocabPreviewResponse | null>(null);
  const [trial, setTrial] = useState<PreviewArticleResponse | null>(null);
  const [message, setMessage] = useState("粘贴词汇后先预览课程结构，再生成第 1 篇试读确认质量。");
  const [loading, setLoading] = useState<LoadingState>(null);

  const importVocabFile = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension !== "txt" && extension !== "csv") {
      setMessage("仅支持导入 TXT 或 CSV 文件。");
      return;
    }

    try {
      const text = await file.text();
      const words = extension === "csv" ? parseCsvWords(text) : parseTextWords(text);

      if (words.length === 0) {
        setMessage("文件里没有识别到词汇，请检查内容后重试。");
        return;
      }

      setRawText(words.join("\n"));
      setPreview(null);
      setTrial(null);
      setMessage(`已从 ${file.name} 导入 ${words.length} 个词条，可继续预览课程结构。`);
    } catch {
      setMessage("文件读取失败，请重新选择 TXT 或 CSV 文件。");
    }
  };

  const previewWords = async () => {
    setLoading("preview");
    setMessage("正在清洗词汇并估算课程结构...");
    try {
      const result = await apiPost<VocabPreviewResponse, { raw_text: string }>("/api/vocab/preview", { raw_text: rawText });
      setPreview(result);
      setTrial(null);
      setMessage(`识别到 ${result.valid_words.length} 个有效词，预计生成 ${result.estimated_articles} 篇。下一步：生成第 1 篇试读。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "预览失败");
    } finally {
      setLoading(null);
    }
  };

  const generateTrial = async () => {
    if (!preview) return;

    setLoading("trial");
    setMessage("正在生成第 1 篇试读文章（约 30 秒）...");
    try {
      const result = await apiPost<PreviewArticleResponse>("/api/generate/preview-article", {
        vocab_set_name: name,
        words: preview.valid_words,
        model_config: loadModelConfig(),
      });
      setTrial(result);
      setMessage(`试读文章已生成。满意的话，点击「继续生成全部 ${result.total_articles} 篇」，生成期间可以离开页面。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "试读生成失败");
    } finally {
      setLoading(null);
    }
  };

  const startFullGeneration = async () => {
    setLoading("start");
    setMessage("正在启动全量生成任务...");
    try {
      const body = trial
        ? { preview_id: trial.preview_id }
        : {
            vocab_set_name: name,
            words: preview?.valid_words ?? [],
            model_config: loadModelConfig(),
          };
      const result = await apiPost<StartCourseResponse>("/api/generate/course-async", body);
      saveActiveGeneration({ taskId: result.task_id, name, startedAt: Date.now() });
      router.push(`/generate-progress/${result.task_id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "启动生成失败");
      setLoading(null);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--neutral-50)] px-5 py-5">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm text-[var(--neutral-700)] shadow-sm">
            <ArrowLeft size={17} />
            返回首页
          </Link>
          <Link href="/settings/model" className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm text-[var(--neutral-700)] shadow-sm">
            <Settings size={17} />
            模型配置
          </Link>
        </div>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--primary-700)]">
            <FileText size={17} />
            新建词库
          </div>
          <h1 className="text-3xl font-bold text-[var(--neutral-900)]">粘贴词汇，生成精读课程</h1>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-[var(--neutral-700)]">
                词库名称
                <input
                  className="h-11 rounded-lg border border-[var(--neutral-200)] px-3 outline-none focus:border-[var(--primary-700)]"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-[var(--neutral-700)]">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>词汇内容</span>
                  <span className="relative inline-flex">
                    <input
                      className="absolute inset-0 cursor-pointer opacity-0"
                      type="file"
                      accept=".txt,.csv,text/plain,text/csv"
                      aria-label="导入 TXT 或 CSV 词汇文件"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void importVocabFile(file);
                      }}
                    />
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--neutral-200)] bg-white px-3 text-xs font-semibold text-[var(--primary-800)]">
                      <Upload size={14} />
                      导入 TXT / CSV
                    </span>
                  </span>
                </span>
                <textarea
                  className="min-h-[280px] rounded-lg border border-[var(--neutral-200)] p-3 font-mono text-sm leading-6 outline-none focus:border-[var(--primary-700)]"
                  value={rawText}
                  onChange={(event) => {
                    setRawText(event.target.value);
                    setPreview(null);
                    setTrial(null);
                  }}
                />
              </label>
            </div>

            <aside className="rounded-lg bg-[var(--neutral-100)] p-4">
              <h2 className="text-base font-bold text-[var(--neutral-900)]">课程预览</h2>
              {preview ? (
                <div className="mt-4 space-y-4">
                  <Stat label="有效词汇" value={`${preview.valid_words.length} 个`} />
                  <Stat label="过滤无效" value={`${preview.invalid_items.length} 个`} />
                  <Stat label="重复词" value={`${preview.duplicate_count} 个`} />
                  <Stat label="预计篇数" value={`${preview.estimated_articles} 篇`} />
                  <div>
                    <div className="mb-2 text-sm font-semibold text-[var(--neutral-700)]">话题分布</div>
                    <div className="space-y-2">
                      {preview.topic_preview.map((topic) => (
                        <div key={topic.topic} className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm">
                          <span>{topic.topic}</span>
                          <span className="font-semibold text-[var(--primary-800)]">{topic.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-7 text-[var(--neutral-700)]">点击“预览课程结构”后，这里会展示清洗结果、预计篇数和话题分布。</p>
              )}
            </aside>
          </div>

          <div className="mt-5 rounded-lg bg-[var(--neutral-100)] p-4 text-sm leading-6 text-[var(--neutral-700)]">{message}</div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--primary-800)] text-sm font-semibold text-[var(--primary-800)] disabled:opacity-60"
              onClick={previewWords}
              disabled={loading !== null || !rawText.trim()}
            >
              {loading === "preview" ? <Loader2 className="animate-spin" size={17} /> : <FileText size={17} />}
              预览课程结构
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary-800)] text-sm font-semibold text-white disabled:opacity-60"
              onClick={generateTrial}
              disabled={loading !== null || !preview}
            >
              {loading === "trial" ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
              生成第 1 篇试读
            </button>
          </div>

          {preview && !trial && (
            <button
              className="mt-3 w-full text-center text-xs text-[var(--neutral-400)] underline-offset-2 hover:underline disabled:opacity-60"
              onClick={startFullGeneration}
              disabled={loading !== null}
              type="button"
            >
              跳过试读，直接生成全部 {preview.estimated_articles} 篇
            </button>
          )}
        </section>

        {trial && (
          <section className="mt-5 rounded-lg bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--primary-700)]">
              <BookOpen size={17} />
              试读 · 第 1 篇
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-serif text-2xl font-bold text-[var(--neutral-900)]">{trial.first_article.title}</h2>
              <div className="flex flex-wrap gap-2 text-xs text-[var(--neutral-400)]">
                <span className="rounded-full bg-[var(--neutral-100)] px-3 py-1">{trial.first_article.topic}</span>
                <span className="rounded-full bg-[var(--neutral-100)] px-3 py-1">{trial.first_article.word_count} 词</span>
                <span className="rounded-full bg-[var(--neutral-100)] px-3 py-1">{trial.first_article.target_word_count} 个目标词</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-100)] px-3 py-1 text-[var(--primary-800)]">
                  <CheckCircle2 size={12} />
                  覆盖率 {Math.round(trial.first_article.quality.coverage * 100)}%
                </span>
              </div>
            </div>

            <div className="mt-4 max-h-80 space-y-4 overflow-y-auto rounded-lg bg-[var(--neutral-50)] p-4">
              {trial.first_article.paragraphs.map((paragraph) => (
                <div key={paragraph.id}>
                  <p className="font-serif text-base leading-8 text-[var(--neutral-900)]">
                    {paragraph.sentences.map((sentence) => sentence.en).join(" ")}
                  </p>
                  <p className="mt-1 text-sm leading-7 text-[var(--neutral-500)]">
                    {paragraph.sentences.map((sentence) => sentence.zh).join(" ")}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--neutral-200)] text-sm font-semibold text-[var(--neutral-700)] disabled:opacity-60"
                onClick={generateTrial}
                disabled={loading !== null}
              >
                {loading === "trial" ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}
                重新生成试读
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary-800)] text-sm font-semibold text-white disabled:opacity-60"
                onClick={startFullGeneration}
                disabled={loading !== null}
              >
                {loading === "start" ? <Loader2 className="animate-spin" size={17} /> : <Play size={17} />}
                {trial.total_articles > 1 ? `继续生成全部 ${trial.total_articles} 篇` : "保存课程并开始阅读"}
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-[var(--neutral-400)]">试读这篇不会重复生成，全量任务会直接续用。生成期间可以离开页面。</p>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm">
      <span className="text-[var(--neutral-700)]">{label}</span>
      <span className="font-semibold text-[var(--neutral-900)]">{value}</span>
    </div>
  );
}

function parseTextWords(text: string) {
  return normalizeWords(text.split(/[\s,;，；、]+/));
}

function parseCsvWords(text: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      quoted = !quoted;
      continue;
    }

    if (!quoted && (char === "," || char === "\n" || char === "\r")) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);

  return normalizeWords(cells.flatMap((cell) => cell.split(/[\s;，；、]+/)));
}

function normalizeWords(items: string[]) {
  const seen = new Set<string>();
  const words: string[] = [];

  items.forEach((item) => {
    const word = item.trim();
    const key = word.toLowerCase();

    if (!word || seen.has(key)) return;

    seen.add(key);
    words.push(word);
  });

  return words;
}
