"use client";

import { ArrowLeft, BookOpen, CheckCircle, Languages, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getDictEntry, type Article, type Sentence } from "@/lib/seed-data";
import { cn } from "@/lib/utils";

interface ReaderViewProps {
  article: Article;
}

type Token =
  | { type: "word"; value: string; key: string }
  | { type: "text"; value: string; key: string };

export function ReaderView({ article }: ReaderViewProps) {
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [dictWord, setDictWord] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(() => {
    if (typeof window === "undefined") return article.progress || 0;
    const saved = localStorage.getItem(`wordscape:progress:${article.id}`);
    return Math.max(article.progress || 0, saved ? Number(saved) : 0);
  });
  const [completedOpen, setCompletedOpen] = useState(false);
  const [translationOpen, setTranslationOpen] = useState(true);

  const targetWords = useMemo(() => {
    return new Set(article.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.targetWords.map((w) => w.toLowerCase()))));
  }, [article]);

  const allTargetWords = useMemo(() => Array.from(targetWords).slice(0, 18), [targetWords]);

  useEffect(() => {
    const handleScroll = () => {
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - window.innerHeight;
      const nextProgress = maxScroll <= 0 ? 100 : Math.round((window.scrollY / maxScroll) * 100);
      const bounded = Math.max(article.progress || 0, Math.min(100, nextProgress));
      setScrollProgress(bounded);
      localStorage.setItem(`wordscape:progress:${article.id}`, String(bounded));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [article.id, article.progress]);

  const completeReading = () => {
    setScrollProgress(100);
    localStorage.setItem(`wordscape:progress:${article.id}`, "100");
    setCompletedOpen(true);
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

  return (
    <main className="min-h-screen bg-[var(--neutral-100)] text-[var(--neutral-900)]">
      <header className="sticky top-0 z-20 border-b border-[var(--neutral-200)] bg-[var(--neutral-100)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            href={article.courseId === "generated" ? "/generated-course" : `/courses/${article.courseId}`}
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
                      onActivate={() => speakSentence(sentence)}
                      onOpenDict={setDictWord}
                    />
                  ))}
                </p>
              ))}
            </div>

            <button
              className="mt-10 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary-800)] text-sm font-semibold text-white shadow-sm"
              onClick={completeReading}
              type="button"
            >
              <CheckCircle size={18} />
              阅读完成
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

      <DictCard word={dictWord} onClose={() => setDictWord(null)} />
      <CompletionDialog
        open={completedOpen}
        onClose={() => setCompletedOpen(false)}
        courseId={article.courseId}
        words={allTargetWords}
        progress={scrollProgress}
      />
    </main>
  );
}

function SentenceBlock({
  sentence,
  targetWords,
  active,
  onActivate,
  onOpenDict,
}: {
  sentence: Sentence;
  targetWords: Set<string>;
  active: boolean;
  onActivate: () => void;
  onOpenDict: (word: string) => void;
}) {
  return (
    <span
      className={cn("cursor-pointer rounded px-1 transition-colors", active && "bg-[var(--primary-100)]")}
      onClick={onActivate}
    >
      {tokenize(sentence.en).map((token) => {
        if (token.type === "text") {
          return <span key={token.key}>{token.value}</span>;
        }

        const normalized = token.value.toLowerCase();
        const isTarget = targetWords.has(normalized);

        return (
          <span
            key={token.key}
            className={cn(
              "rounded-sm px-0.5 transition",
              isTarget
                ? "cursor-pointer border-b-2 border-[var(--accent-400)] bg-[rgba(244,162,97,0.32)] hover:bg-[rgba(244,162,97,0.58)]"
                : "cursor-text hover:bg-white/70",
            )}
            onClick={(event) => {
              if (!isTarget) return;
              event.stopPropagation();
              onOpenDict(normalized);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onOpenDict(normalized);
            }}
          >
            {token.value}
          </span>
        );
      })}{" "}
    </span>
  );
}

function DictCard({ word, onClose }: { word: string | null; onClose: () => void }) {
  const [wordbook, setWordbook] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("wordscape:wordbook");
    if (!saved) return [];

    try {
      return JSON.parse(saved) as string[];
    } catch {
      return [];
    }
  });

  if (!word) return null;

  const entry = getDictEntry(word);
  const inWordbook = wordbook.includes(word);

  const speakWord = () => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(entry?.word ?? word);
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  };

  const toggleWordbook = () => {
    const next = inWordbook ? wordbook.filter((item) => item !== word) : [...wordbook, word];
    setWordbook(next);
    localStorage.setItem("wordscape:wordbook", JSON.stringify(next));
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/35" onClick={onClose}>
      <section
        className="absolute inset-x-0 bottom-0 max-h-[72vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl md:bottom-auto md:left-auto md:right-6 md:top-24 md:w-80 md:rounded-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={`${word} dictionary card`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--neutral-200)] md:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="min-w-0">
              <h2 className="font-serif text-2xl font-bold text-[var(--neutral-900)]">{entry?.word ?? word}</h2>
              <p className="mt-1 font-mono text-sm text-[var(--neutral-400)]">{entry?.phonetic ?? "暂无音标"}</p>
            </div>
            <button
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-100)] text-[var(--primary-800)]"
              onClick={speakWord}
              type="button"
              aria-label={`朗读 ${entry?.word ?? word}`}
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

            <button
              className={cn(
                "w-full rounded-lg py-3 text-sm font-semibold",
                inWordbook ? "bg-[var(--primary-100)] text-[var(--primary-900)]" : "bg-[var(--primary-800)] text-white",
              )}
              onClick={toggleWordbook}
            >
              {inWordbook ? "已加入生词本" : "加入生词本"}
            </button>
          </div>
        ) : (
          <div className="mt-5 rounded-lg bg-[var(--neutral-100)] p-4 text-sm leading-6 text-[var(--neutral-700)]">
            本地示例词典里还没有这个词。后续接入词典生成和数据库后会自动补全。
          </div>
        )}
      </section>
    </div>
  );
}

function CompletionDialog({
  open,
  onClose,
  courseId,
  words,
  progress,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  words: string[];
  progress: number;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/35 px-5" onClick={onClose}>
      <section className="mx-auto mt-24 max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="文章完成">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[var(--primary-700)]">阅读完成</div>
            <h2 className="mt-1 text-2xl font-bold text-[var(--neutral-900)]">本篇目标词已接触</h2>
          </div>
          <button className="rounded-full bg-[var(--neutral-100)] p-2 text-[var(--neutral-700)]" onClick={onClose} aria-label="关闭">
            <X size={17} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {words.map((word) => (
            <span key={word} className="rounded-full bg-[var(--neutral-100)] px-3 py-1 text-xs font-medium text-[var(--neutral-700)]">
              {word}
            </span>
          ))}
        </div>

        <div className="mt-5 rounded-lg bg-[var(--neutral-100)] p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-[var(--neutral-700)]">阅读进度</span>
            <span className="font-semibold text-[var(--primary-800)]">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[var(--primary-700)]" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <Link href={courseId === "generated" ? "/generated-course" : `/courses/${courseId}`} className="mt-5 flex h-11 items-center justify-center rounded-lg bg-[var(--primary-800)] text-sm font-semibold text-white">
          返回课程列表
        </Link>
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
