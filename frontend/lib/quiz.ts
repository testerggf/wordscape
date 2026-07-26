import type { Article, Sentence } from "@/lib/seed-data";
import { lemmaCandidates } from "@/lib/lemma";

export interface QuizQuestion {
  /** 词表里的目标词（选项与判分用） */
  word: string;
  /** 原文中出现的形式 */
  display: string;
  /** 挖空后的英文句子 */
  blankedEn: string;
  sentenceEn: string;
  sentenceZh: string;
  sentenceId: string;
  /** 选项（含正确项，已打乱） */
  options: string[];
}

const BLANK = "______";

/** 从文章原句生成挖空选择题：每题从本文其他目标词中取干扰项，纯前端无需 AI。 */
export function buildQuiz(article: Article, maxQuestions = 8): QuizQuestion[] {
  const allTargetWords = Array.from(
    new Set(article.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.targetWords.map((w) => w.toLowerCase())))),
  );

  const candidates: QuizQuestion[] = [];
  const usedWords = new Set<string>();

  for (const paragraph of article.paragraphs) {
    for (const sentence of paragraph.sentences) {
      for (const target of sentence.targetWords) {
        const word = target.toLowerCase();
        if (usedWords.has(word)) continue;

        const blanked = blankWord(sentence, word);
        if (!blanked) continue;

        usedWords.add(word);
        candidates.push({
          word,
          display: blanked.display,
          blankedEn: blanked.text,
          sentenceEn: sentence.en,
          sentenceZh: sentence.zh,
          sentenceId: sentence.id,
          options: [],
        });
      }
    }
  }

  const questions = shuffle(candidates).slice(0, maxQuestions);

  for (const question of questions) {
    const distractors = shuffle(allTargetWords.filter((word) => word !== question.word)).slice(0, 3);
    question.options = shuffle([question.word, ...distractors]);
  }

  return questions;
}

/** 在句子里找到目标词（含变形）并替换为空格线。找不到返回 null。 */
function blankWord(sentence: Sentence, word: string): { text: string; display: string } | null {
  const tokens = sentence.en.split(/(\b[A-Za-z'-]+\b)/);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!/^[A-Za-z'-]+$/.test(token)) continue;

    if (lemmaCandidates(token).includes(word)) {
      const replaced = [...tokens];
      replaced[index] = BLANK;
      return { text: replaced.join(""), display: token };
    }
  }

  return null;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
