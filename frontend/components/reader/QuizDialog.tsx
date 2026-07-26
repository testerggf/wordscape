"use client";

import Link from "next/link";
import { BookMarked, CheckCircle2, ChevronRight, Lock, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Article } from "@/lib/seed-data";
import { buildQuiz, type QuizQuestion } from "@/lib/quiz";
import { addWordbookEntry, loadWordbook } from "@/lib/wordbook";
import { cn } from "@/lib/utils";

interface QuizDialogProps {
  article: Article;
  backHref: string;
  onClose: () => void;
  /** 进入结果页（完成或跳过）时回调，用于标记文章完成并记录成绩 */
  onFinish: (result: { correct: number; total: number } | null) => void;
}

type Stage = "question" | "result" | "skipped";

export function QuizDialog({ article, backHref, onClose, onFinish }: QuizDialogProps) {
  const questions = useMemo(() => buildQuiz(article), [article]);
  const [stage, setStage] = useState<Stage>(questions.length === 0 ? "skipped" : "question");
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Array<{ question: QuizQuestion; correct: boolean }>>([]);
  const [addedWords, setAddedWords] = useState(false);
  const [selectedWrong, setSelectedWrong] = useState<Set<string>>(new Set());
  const finishedRef = useRef(false);

  const question = questions[current];
  const correctCount = answers.filter((item) => item.correct).length;
  const wrongAnswers = answers.filter((item) => !item.correct);

  const markFinished = (result: { correct: number; total: number } | null) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(result);
  };

  // 文章没有可出题的目标词时，直接按跳过处理并标记完成
  useEffect(() => {
    if (questions.length === 0) markFinished(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length]);

  const skipQuiz = () => {
    markFinished(null);
    setStage("skipped");
  };

  const pick = (option: string) => {
    if (picked !== null || !question) return;
    setPicked(option);
    const correct = option === question.word;
    setAnswers((prev) => [...prev, { question, correct }]);
    if (!correct) {
      setSelectedWrong((prev) => new Set(prev).add(question.word));
    }
  };

  const next = () => {
    if (current + 1 >= questions.length) {
      markFinished({ correct: answers.filter((item) => item.correct).length, total: questions.length });
      setStage("result");
      return;
    }
    setCurrent((value) => value + 1);
    setPicked(null);
  };

  const addWrongToWordbook = () => {
    const existing = loadWordbook();
    const existingWords = new Set(existing.map((entry) => entry.word));

    wrongAnswers.forEach(({ question: q }) => {
      if (!selectedWrong.has(q.word) || existingWords.has(q.word)) return;
      addWordbookEntry({
        word: q.word,
        articleId: article.id,
        articleTitle: article.title,
        readHref: window.location.pathname,
        sentenceId: q.sentenceId,
        sentenceEn: q.sentenceEn,
        sentenceZh: q.sentenceZh,
      });
    });
    setAddedWords(true);
  };

  const showPaywallHint = article.courseId === "cet4" && article.index === 5;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 px-5 py-8">
      <section
        className="mx-auto max-w-lg rounded-xl bg-white p-5 shadow-2xl"
        role="dialog"
        aria-label="读后小测"
      >
        {stage === "question" && question && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[var(--primary-700)]">读后小测</div>
                <h2 className="mt-1 text-xl font-bold text-[var(--neutral-900)]">
                  第 {current + 1}/{questions.length} 题 · 选出空格里的词
                </h2>
              </div>
              <button
                className="shrink-0 text-xs text-[var(--neutral-400)] underline-offset-2 hover:underline"
                onClick={skipQuiz}
                type="button"
              >
                跳过小测
              </button>
            </div>

            <p className="mt-5 rounded-lg bg-[var(--neutral-100)] p-4 font-serif text-base leading-8 text-[var(--neutral-900)]">
              {question.blankedEn}
            </p>
            {picked !== null && <p className="mt-2 px-1 text-sm leading-7 text-[var(--neutral-500)]">{question.sentenceZh}</p>}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {question.options.map((option) => {
                const isCorrect = option === question.word;
                const isPicked = option === picked;

                return (
                  <button
                    key={option}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-left font-serif text-base transition",
                      picked === null && "border-[var(--neutral-200)] hover:border-[var(--primary-700)]",
                      picked !== null && isCorrect && "border-green-600 bg-green-50 text-green-800",
                      picked !== null && isPicked && !isCorrect && "border-red-500 bg-red-50 text-red-700",
                      picked !== null && !isPicked && !isCorrect && "border-[var(--neutral-100)] text-[var(--neutral-400)]",
                    )}
                    onClick={() => pick(option)}
                    disabled={picked !== null}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-2">
                      {option}
                      {picked !== null && isCorrect && <CheckCircle2 size={16} className="shrink-0 text-green-600" />}
                      {picked !== null && isPicked && !isCorrect && <XCircle size={16} className="shrink-0 text-red-500" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {picked !== null && (
              <button
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary-800)] text-sm font-semibold text-white"
                onClick={next}
                type="button"
              >
                {current + 1 >= questions.length ? "查看结果" : "下一题"}
                <ChevronRight size={16} />
              </button>
            )}
          </>
        )}

        {stage === "result" && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[var(--primary-700)]">本篇完成</div>
                <h2 className="mt-1 text-2xl font-bold text-[var(--neutral-900)]">
                  掌握 {correctCount}/{questions.length} 个目标词
                </h2>
              </div>
              <button className="rounded-full bg-[var(--neutral-100)] p-2 text-[var(--neutral-700)]" onClick={onClose} aria-label="关闭">
                <X size={17} />
              </button>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--neutral-100)]">
              <div
                className="h-full rounded-full bg-[var(--primary-700)]"
                style={{ width: `${questions.length === 0 ? 0 : Math.round((correctCount / questions.length) * 100)}%` }}
              />
            </div>

            {wrongAnswers.length > 0 ? (
              <div className="mt-5 rounded-lg bg-[var(--neutral-100)] p-4">
                <div className="mb-3 text-sm font-semibold text-[var(--neutral-700)]">答错的词（勾选加入生词本复习）</div>
                <div className="flex flex-wrap gap-2">
                  {wrongAnswers.map(({ question: q }) => {
                    const selected = selectedWrong.has(q.word);
                    return (
                      <button
                        key={q.word}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                          selected
                            ? "border-[var(--primary-800)] bg-[var(--primary-800)] text-white"
                            : "border-[var(--neutral-200)] bg-white text-[var(--neutral-700)]",
                        )}
                        onClick={() => {
                          if (addedWords) return;
                          setSelectedWrong((prev) => {
                            const nextSet = new Set(prev);
                            if (nextSet.has(q.word)) {
                              nextSet.delete(q.word);
                            } else {
                              nextSet.add(q.word);
                            }
                            return nextSet;
                          });
                        }}
                        type="button"
                      >
                        {q.word}
                      </button>
                    );
                  })}
                </div>
                <button
                  className={cn(
                    "mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold",
                    addedWords ? "bg-[var(--primary-100)] text-[var(--primary-900)]" : "bg-[var(--primary-800)] text-white",
                  )}
                  onClick={addWrongToWordbook}
                  disabled={addedWords || selectedWrong.size === 0}
                  type="button"
                >
                  <BookMarked size={15} />
                  {addedWords ? "已加入生词本" : `加入生词本（${selectedWrong.size} 个）`}
                </button>
              </div>
            ) : (
              <p className="mt-5 rounded-lg bg-[var(--primary-100)] p-4 text-sm leading-6 text-[var(--primary-900)]">
                全部答对！这些目标词你已经初步掌握，继续保持。
              </p>
            )}

            {showPaywallHint && (
              <div className="mt-4 rounded-lg border border-[var(--accent-200)] bg-[#FFF8EF] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-600)]">
                  <Lock size={15} />
                  免费 5 篇已读完
                </div>
                <p className="mt-1 text-sm leading-6 text-[var(--neutral-700)]">你已经掌握了这么多词，解锁完整课程继续保持节奏。</p>
              </div>
            )}

            <Link href={backHref} className="mt-5 flex h-11 items-center justify-center rounded-lg bg-[var(--primary-800)] text-sm font-semibold text-white">
              返回课程列表
            </Link>
          </>
        )}

        {stage === "skipped" && (
          <>
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
              {Array.from(new Set(article.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.targetWords))))
                .slice(0, 18)
                .map((word) => (
                  <span key={word} className="rounded-full bg-[var(--neutral-100)] px-3 py-1 text-xs font-medium text-[var(--neutral-700)]">
                    {word}
                  </span>
                ))}
            </div>

            <Link href={backHref} className="mt-5 flex h-11 items-center justify-center rounded-lg bg-[var(--primary-800)] text-sm font-semibold text-white">
              返回课程列表
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
