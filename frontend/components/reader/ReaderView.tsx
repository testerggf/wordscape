"use client";

import { ArrowLeft, BookMarked, BookOpen, CheckCircle, History, Languages, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { QuizDialog } from "@/components/reader/QuizDialog";
import { getDictEntry, type Article, type Sentence } from "@/lib/seed-data";
import { lemmaCandidates, resolveInSet, resolveWith } from "@/lib/lemma";
import { loadProgress, saveProgress, type ArticleProgress } from "@/lib/reading-progress";
import { addWordbookEntry, isInWordbook, loadWordbook, removeWordbookEntry } from "@/lib/wordbook";
import { WORDBOOK_EVENTS, useClientValue } from "@/lib/use-client-value";
import { cn } from "@/lib/utils";

interface ReaderViewProps {
  article: Article;
  /** 返回课程列表的链接 */
  backHref: string;
}

interface DictContext {
  rawWord: string;
  sentence: Sentence;
}

type Token =
  | { type: "word"; value: string; key: string }
  | { type: "text"; value: string; key: string };

export function ReaderView({ article, backHref }: ReaderViewProps) {
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [flashSentenceId, setFlashSentenceId] = useState<string | null>(null);
  const [dictContext, setDictContext] = useState<DictContext | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);
  const [translationOpen, setTranslationOpen] = useState(true);
  const [resumeTarget, setResumeTarget] = useState<ArticleProgress | null>(null);
  const wordbookCount = useClientValue(() => loadWordbook().length, 0, WORDBOOK_EVENTS);
  const lastSaveAt = useRef(0);

  const targetWords = useMemo(() => {
    return new Set(article.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.targetWords.map((w) => w.toLowerCase()))));
  }, [article]);

  // 初始化：恢复进度 / 处理 ?sentence= 深链（放入 rAF 回调，等首帧渲染完成后执行）
  useEffect(() => {
    let flashTimer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      const progress = loadProgress(article.id);
      setScrollProgress(progress.completed ? 100 : progress.percent);

      const deepLink = new URLSearchParams(window.location.search).get("sentence");
      if (deepLink) {
        scrollToSentence(deepLink, "auto");
        setFlashSentenceId(deepLink);
        flashTimer = setTimeout(() => setFlashSentenceId(null), 2600);
        return;
      }

      if (!progress.completed && progress.percent >= 5 && progress.anchorSentenceId) {
        setResumeTarget(progress);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      if (flashTimer) clearTimeout(flashTimer);
    };
  }, [article.id]);

  // 滚动：更新百分比 + 句子锚点；节流写入并带尾随保存，避免丢掉滚动结束时的位置
  useEffect(() => {
    let ticking = false;
    let trailing: ReturnType<typeof setTimeout> | undefined;

    const persistNow = () => {
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - window.innerHeight;
      const rawPercent = maxScroll <= 0 ? 99 : Math.round((window.scrollY / maxScroll) * 100);
      const saved = loadProgress(article.id);
      const percent = saved.completed ? 100 : Math.min(99, Math.max(saved.percent, rawPercent));
      const anchor = findAnchorSentence();
      saveProgress(article.id, {
        percent,
        anchorSentenceId: anchor ?? saved.anchorSentenceId,
      });
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        ticking = false;
        const doc = document.documentElement;
        const maxScroll = doc.scrollHeight - window.innerHeight;
        const rawPercent = maxScroll <= 0 ? 99 : Math.round((window.scrollY / maxScroll) * 100);

        const saved = loadProgress(article.id);
        const percent = saved.completed ? 100 : Math.min(99, Math.max(saved.percent, rawPercent));
        setScrollProgress(percent);

        const now = Date.now();
        if (now - lastSaveAt.current >= 500) {
          lastSaveAt.current = now;
          persistNow();
        } else {
          clearTimeout(trailing);
          trailing = setTimeout(() => {
            lastSaveAt.current = Date.now();
            persistNow();
          }, 600);
        }
      });
    };

    const persistOnHide = () => persistNow();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", persistOnHide);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", persistOnHide);
      clearTimeout(trailing);
    };
  }, [article.id]);

  const finishQuiz = (result: { correct: number; total: number } | null) => {
    saveProgress(article.id, {
      completed: true,
      percent: 100,
      quiz: result ? { ...result, at: Date.now() } : null,
    });
    setScrollProgress(100);
  };

  const speakSentence = (sentence: Sentence) => {
    setActiveSentenceId(sentence.id);

    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentence.en);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    utterance.onend = () => setActiveSentenceId(null);
    utterance.onerror = () => setActiveSentenceId(null);
    window.speechSynthesis.speak(utterance);
  };

  const resumeReading = () => {
    if (resumeTarget?.anchorSentenceId) {
      scrollToSentence(resumeTarget.anchorSentenceId, "smooth");
      setFlashSentenceId(resumeTarget.anchorSentenceId);
      setTimeout(() => setFlashSentenceId(null), 2600);
    }
    setResumeTarget(null);
  };

  return (
    <main className="min-h-screen bg-[var(--neutral-100)] text-[var(--neutral-900)]">
      <header className="sticky top-0 z-20 border-b border-[var(--neutral-200)] bg-[var(--neutral-100)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            href={backHref}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--neutral-700)] shadow-sm"
            aria-label="返回课程"
          >
            <ArrowLeft size={19} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-sm font-medium text-[var(--neutral-700)]">{article.topic} · 第 {article.index} 篇</div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--neutral-200)]">
              <div className="h-full rounded-full bg-[var(--primary-700)]" style={{ width: `${scrollProgress}%` }} />
            </div>
          </div>
          <Link
            href="/wordbook"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--neutral-700)] shadow-sm"
            aria-label="生词本"
          >
            <BookMarked size={18} />
            {wordbookCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent-400)] px-1 text-[10px] font-bold text-white">
                {wordbookCount > 99 ? "99+" : wordbookCount}
              </span>
            )}
          </Link>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--neutral-700)] shadow-sm"
            aria-label="朗读首句"
            onClick={() => {
              const firstSentence = article.paragraphs[0]?.sentences[0];
              if (firstSentence) speakSentence(firstSentence);
            }}
          >
            <Volume2 size={18} />
          </button>
        </div>
      </header>

      {resumeTarget && (
        <div className="sticky top-[65px] z-10 border-b border-[var(--accent-200)] bg-[#FFF8EF]">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 text-sm">
            <History size={16} className="shrink-0 text-[var(--accent-600)]" />
            <span className="min-w-0 flex-1 text-[var(--neutral-700)]">
              上次读到 {resumeTarget.percent}%（第 {resumeTarget.anchorSentenceId?.split("-")[0]} 段），要继续吗？
            </span>
            <button
              className="shrink-0 rounded-full bg-[var(--primary-800)] px-4 py-1.5 text-xs font-semibold text-white"
              onClick={resumeReading}
              type="button"
            >
              继续阅读
            </button>
            <button
              className="shrink-0 rounded-full border border-[var(--neutral-200)] bg-white px-3 py-1.5 text-xs text-[var(--neutral-700)]"
              onClick={() => setResumeTarget(null)}
              type="button"
            >
              从头开始
            </button>
          </div>
        </div>
      )}

      <div className={cn("mx-auto grid max-w-6xl gap-0", translationOpen ? "lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]" : "lg:grid-cols-1")}>
        <article className={cn("px-5 pt-8 lg:px-10", translationOpen ? "pb-52 lg:pb-16" : "pb-16")}>
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--primary-800)]">
              <BookOpen size={14} />
              {article.targetWordCount} 个目标词
            </div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="min-w-0 font-serif text-3xl font-bold leading-tight text-[var(--neutral-900)]">{article.title}</h1>
              <button
                className={cn(
                  "mt-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
                  translationOpen
                    ? "border-[var(--primary-800)] bg-[var(--primary-800)] text-white"
                    : "border-[var(--neutral-200)] bg-white text-[var(--primary-800)] hover:border-[var(--primary-700)]",
                )}
                onClick={() => setTranslationOpen((open) => !open)}
                type="button"
                aria-pressed={translationOpen}
              >
                <Languages size={15} />
                中英对照
              </button>
            </div>

            <div className="mt-8 space-y-6 font-serif text-[1.08rem] leading-[1.95] lg:text-xl">
              {article.paragraphs.map((paragraph) => (
                <p key={paragraph.id}>
                  {paragraph.sentences.map((sentence) => (
                    <SentenceBlock
                      key={sentence.id}
                      sentence={sentence}
                      targetWords={targetWords}
                      active={activeSentenceId === sentence.id}
                      flashed={flashSentenceId === sentence.id}
                      onActivate={() => speakSentence(sentence)}
                      onOpenDict={(rawWord) => setDictContext({ rawWord, sentence })}
                    />
                  ))}
                </p>
              ))}
            </div>

            <button
              className="mt-10 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary-800)] text-sm font-semibold text-white shadow-sm"
              onClick={() => setQuizOpen(true)}
              type="button"
            >
              <CheckCircle size={18} />
              完成阅读，测一测
            </button>
          </div>
        </article>

        {translationOpen && (
          <aside className="fixed inset-x-0 bottom-0 z-10 max-h-[34vh] overflow-y-auto rounded-t-2xl border-t border-[var(--neutral-200)] bg-white px-5 py-4 shadow-2xl lg:sticky lg:top-[65px] lg:h-[calc(100vh-65px)] lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0 lg:px-8 lg:py-8 lg:shadow-none">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--neutral-700)]">中文对照</h2>
              <span className="text-xs text-[var(--neutral-400)]">同步当前句</span>
            </div>
            <div className="space-y-4 text-sm leading-8 text-[var(--neutral-700)] lg:text-base">
              {article.paragraphs.map((paragraph) => (
                <p key={paragraph.id}>
                  {paragraph.sentences.map((sentence) => (
                    <span
                      key={sentence.id}
                      className={cn("rounded px-1 transition", activeSentenceId === sentence.id && "bg-[var(--primary-100)] text-[var(--primary-900)]")}
                    >
                      {sentence.zh}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          </aside>
        )}
      </div>

      <DictCard context={dictContext} article={article} onClose={() => setDictContext(null)} />
      {quizOpen && (
        <QuizDialog article={article} backHref={backHref} onClose={() => setQuizOpen(false)} onFinish={finishQuiz} />
      )}
    </main>
  );
}

function scrollToSentence(sentenceId: string, behavior: ScrollBehavior) {
  requestAnimationFrame(() => {
    document.getElementById(`s-${sentenceId}`)?.scrollIntoView({ behavior, block: "center" });
  });
}

function findAnchorSentence(): string | null {
  const nodes = document.querySelectorAll<HTMLElement>("[data-sentence-id]");
  let anchor: string | null = null;

  for (const node of nodes) {
    if (node.getBoundingClientRect().top > 160) break;
    anchor = node.dataset.sentenceId ?? null;
  }

  return anchor ?? nodes[0]?.dataset.sentenceId ?? null;
}

function SentenceBlock({
  sentence,
  targetWords,
  active,
  flashed,
  onActivate,
  onOpenDict,
}: {
  sentence: Sentence;
  targetWords: Set<string>;
  active: boolean;
  flashed: boolean;
  onActivate: () => void;
  onOpenDict: (word: string) => void;
}) {
  return (
    <span
      id={`s-${sentence.id}`}
      data-sentence-id={sentence.id}
      className={cn(
        "cursor-pointer rounded px-1 transition-colors",
        active && "bg-[var(--primary-100)]",
        flashed && "bg-[rgba(244,162,97,0.35)]",
      )}
      onClick={onActivate}
    >
      {tokenize(sentence.en).map((token) => {
        if (token.type === "text") {
          return <span key={token.key}>{token.value}</span>;
        }

        const matchedTarget = resolveInSet(token.value, targetWords);

        return (
          <span
            key={token.key}
            className={cn(
              "rounded-sm px-0.5 transition",
              matchedTarget
                ? "cursor-pointer border-b-2 border-[var(--accent-400)] bg-[rgba(244,162,97,0.32)] hover:bg-[rgba(244,162,97,0.58)]"
                : "cursor-text hover:bg-white/70",
            )}
            onClick={(event) => {
              if (!matchedTarget) return;
              event.stopPropagation();
              onOpenDict(token.value);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onOpenDict(token.value);
            }}
          >
            {token.value}
          </span>
        );
      })}{" "}
    </span>
  );
}

const EMPTY_WORDBOOK: never[] = [];

function DictCard({ context, article, onClose }: { context: DictContext | null; article: Article; onClose: () => void }) {
  const wordbook = useClientValue(loadWordbook, EMPTY_WORDBOOK, WORDBOOK_EVENTS);

  if (!context) return null;

  const { rawWord, sentence } = context;
  const resolved = resolveWith(rawWord, (candidate) => getDictEntry(candidate));
  const entry = resolved?.value;
  // 生词本归一键：词典词条优先，其次是原形候选（小写原词）
  const wordKey = entry?.word ?? lemmaCandidates(rawWord)[0] ?? rawWord.toLowerCase();
  const inWordbook = isInWordbook(wordbook, wordKey);

  const speakWord = () => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(entry?.word ?? rawWord);
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  };

  const toggleWordbook = () => {
    if (inWordbook) {
      removeWordbookEntry(wordKey);
      return;
    }

    addWordbookEntry({
      word: wordKey,
      articleId: article.id,
      articleTitle: article.title,
      readHref: window.location.pathname,
      sentenceId: sentence.id,
      sentenceEn: sentence.en,
      sentenceZh: sentence.zh,
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/35" onClick={onClose}>
      <section
        className="absolute inset-x-0 bottom-0 max-h-[72vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl md:bottom-auto md:left-auto md:right-6 md:top-24 md:w-80 md:rounded-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={`${wordKey} dictionary card`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--neutral-200)] md:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="min-w-0">
              <h2 className="font-serif text-2xl font-bold text-[var(--neutral-900)]">{entry?.word ?? wordKey}</h2>
              {entry && entry.word !== rawWord.toLowerCase() && (
                <p className="mt-0.5 text-xs text-[var(--neutral-400)]">原文形式：{rawWord}</p>
              )}
              <p className="mt-1 font-mono text-sm text-[var(--neutral-400)]">{entry?.phonetic ?? "暂无音标"}</p>
            </div>
            <button
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-100)] text-[var(--primary-800)]"
              onClick={speakWord}
              type="button"
              aria-label={`朗读 ${entry?.word ?? rawWord}`}
            >
              <Volume2 size={17} />
            </button>
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--neutral-100)] text-[var(--neutral-700)]" onClick={onClose} aria-label="关闭词典">
            <X size={17} />
          </button>
        </div>

        {entry ? (
          <div className="mt-5 space-y-5">
            <div>
              <div className="mb-2 text-xs font-semibold text-[var(--neutral-400)]">{entry.pos}</div>
              <ul className="space-y-1 text-sm text-[var(--neutral-900)]">
                {entry.definitions.map((definition) => (
                  <li key={definition}>{definition}</li>
                ))}
              </ul>
            </div>

            {entry.etymology && (
              <div className="border-t border-[var(--neutral-200)] pt-4">
                <div className="mb-1 text-xs font-semibold text-[var(--neutral-400)]">词根词源</div>
                <p className="text-sm leading-6 text-[var(--neutral-700)]">{entry.etymology}</p>
              </div>
            )}

            <div className="border-t border-[var(--neutral-200)] pt-4">
              <div className="mb-2 text-xs font-semibold text-[var(--neutral-400)]">例句</div>
              <div className="space-y-3">
                {entry.examples.map((example) => (
                  <div key={example.en} className="text-sm leading-6">
                    <p className="font-serif italic text-[var(--neutral-900)]">{example.en}</p>
                    <p className="mt-1 text-[var(--neutral-500)]">{example.zh}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg bg-[var(--neutral-100)] p-4 text-sm leading-6 text-[var(--neutral-700)]">
              本地词典还没有这个词的完整词条，可以先加入生词本，语境例句已为你保存。
            </div>
            <div className="rounded-lg border border-[var(--neutral-200)] p-4 text-sm leading-6">
              <p className="font-serif italic text-[var(--neutral-900)]">{sentence.en}</p>
              <p className="mt-1 text-[var(--neutral-500)]">{sentence.zh}</p>
            </div>
          </div>
        )}

        <button
          className={cn(
            "mt-5 w-full rounded-lg py-3 text-sm font-semibold",
            inWordbook ? "bg-[var(--primary-100)] text-[var(--primary-900)]" : "bg-[var(--primary-800)] text-white",
          )}
          onClick={toggleWordbook}
        >
          {inWordbook ? "已加入生词本" : "加入生词本"}
        </button>
      </section>
    </div>
  );
}

function tokenize(text: string): Token[] {
  const regex = /([A-Za-z'-]+)|([^A-Za-z'-]+)/g;
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      type: match[1] ? "word" : "text",
      value: match[1] ?? match[2],
      key: `${index}-${match[0]}`,
    });
    index += 1;
  }

  return tokens;
}
