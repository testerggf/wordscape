"use client";

import Link from "next/link";
import { ArrowLeft, BookMarked, ChevronDown, ExternalLink, Trash2, Volume2 } from "lucide-react";
import { useState } from "react";
import { getDictEntry } from "@/lib/seed-data";
import { resolveWith } from "@/lib/lemma";
import { loadWordbook, removeWordbookEntry, type WordbookEntry } from "@/lib/wordbook";
import { WORDBOOK_EVENTS, useClientValue } from "@/lib/use-client-value";
import { cn } from "@/lib/utils";

const EMPTY_ENTRIES: WordbookEntry[] = [];

export default function WordbookPage() {
  const entries = useClientValue(loadWordbook, EMPTY_ENTRIES, WORDBOOK_EVENTS);
  const [expanded, setExpanded] = useState<string | null>(null);

  const removeEntry = (word: string) => {
    removeWordbookEntry(word);
    if (expanded === word) setExpanded(null);
  };

  return (
    <main className="min-h-screen bg-[var(--neutral-50)] px-5 py-5">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-5 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm text-[var(--neutral-700)] shadow-sm">
          <ArrowLeft size={17} />
          返回首页
        </Link>

        <section className="rounded-lg bg-[var(--primary-800)] p-5 text-white">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <BookMarked size={16} />
            生词本
          </div>
          <h1 className="mt-1 text-3xl font-bold">我的收藏词汇</h1>
          <p className="mt-2 text-sm text-white/75">共 {entries.length} 个词，点击词条可展开释义并回到它出现的语境。</p>
        </section>

        {entries.length === 0 ? (
          <section className="mt-5 rounded-lg bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-[var(--neutral-900)]">还没有收藏任何词</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--neutral-700)]">
              在阅读文章时点击高亮的目标词，或双击任意单词，在词典卡片里点「加入生词本」。
            </p>
            <Link href="/courses/cet4" className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-[var(--primary-800)] px-5 text-sm font-semibold text-white">
              去阅读收词
            </Link>
          </section>
        ) : (
          <section className="mt-5 grid gap-3">
            {entries.map((entry) => (
              <WordbookCard
                key={entry.word}
                entry={entry}
                expanded={expanded === entry.word}
                onToggle={() => setExpanded(expanded === entry.word ? null : entry.word)}
                onRemove={() => removeEntry(entry.word)}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function WordbookCard({
  entry,
  expanded,
  onToggle,
  onRemove,
}: {
  entry: WordbookEntry;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const resolved = resolveWith(entry.word, (candidate) => getDictEntry(candidate));
  const dict = resolved?.value;

  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(entry.word);
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="rounded-lg border border-[var(--neutral-200)] bg-white transition hover:border-[var(--primary-700)]">
      <button className="flex w-full items-center gap-4 p-4 text-left" onClick={onToggle} type="button" aria-expanded={expanded}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-serif text-xl font-bold text-[var(--neutral-900)]">{entry.word}</span>
            {dict && <span className="font-mono text-xs text-[var(--neutral-400)]">{dict.phonetic}</span>}
            {dict && <span className="text-xs text-[var(--neutral-400)]">{dict.pos}</span>}
          </div>
          <div className="mt-1 truncate text-sm text-[var(--neutral-700)]">
            {dict ? dict.definitions.join("；") : entry.sentenceZh ?? "点击展开语境例句"}
          </div>
        </div>
        <ChevronDown size={18} className={cn("shrink-0 text-[var(--neutral-400)] transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t border-[var(--neutral-100)] px-4 pb-4">
          <div className="mt-3 flex items-center gap-2">
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--primary-100)] px-3 text-xs font-semibold text-[var(--primary-800)]"
              onClick={speak}
              type="button"
            >
              <Volume2 size={14} />
              发音
            </button>
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--neutral-100)] px-3 text-xs font-semibold text-[var(--neutral-700)]"
              onClick={onRemove}
              type="button"
            >
              <Trash2 size={14} />
              移出生词本
            </button>
          </div>

          {dict && dict.examples.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold text-[var(--neutral-400)]">词典例句</div>
              <div className="space-y-3">
                {dict.examples.map((example) => (
                  <div key={example.en} className="text-sm leading-6">
                    <p className="font-serif italic text-[var(--neutral-900)]">{example.en}</p>
                    <p className="mt-1 text-[var(--neutral-500)]">{example.zh}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entry.sentenceEn && (
            <div className="mt-4 rounded-lg bg-[var(--neutral-100)] p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[var(--neutral-400)]">
                <span>收藏时的语境{entry.articleTitle ? ` · ${entry.articleTitle}` : ""}</span>
              </div>
              <p className="font-serif text-sm italic leading-6 text-[var(--neutral-900)]">{entry.sentenceEn}</p>
              {entry.sentenceZh && <p className="mt-1 text-sm leading-6 text-[var(--neutral-500)]">{entry.sentenceZh}</p>}
              {entry.readHref && entry.sentenceId && (
                <Link
                  href={`${entry.readHref}?sentence=${encodeURIComponent(entry.sentenceId)}`}
                  className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--primary-800)] px-4 text-xs font-semibold text-white"
                >
                  <ExternalLink size={13} />
                  回到语境
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
