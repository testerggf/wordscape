export type ReadingStatus = "done" | "reading" | "unread" | "locked";

export interface Sentence {
  id: string;
  en: string;
  zh: string;
  targetWords: string[];
}

export interface Paragraph {
  id: number;
  sentences: Sentence[];
}

export interface Article {
  id: string;
  courseId: string;
  index: number;
  title: string;
  topic: string;
  targetWordCount: number;
  readingMinutes: number;
  status: ReadingStatus;
  progress: number;
  isFree: boolean;
  paragraphs: Paragraph[];
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  totalArticles: number;
  completedArticles: number;
  masteredWords: number;
  articles: Article[];
}

export interface DictEntry {
  word: string;
  phonetic: string;
  pos: string;
  definitions: string[];
  etymology?: string;
  examples: Array<{
    en: string;
    zh: string;
  }>;
}

export const courses: Course[] = [
  {
    id: "cet4",
    title: "大学英语四级",
    subtitle: "40 篇故事覆盖核心四级词汇",
    totalArticles: 40,
    completedArticles: 1,
    masteredWords: 118,
    articles: [
      {
        id: "cet4-001",
        courseId: "cet4",
        index: 1,
        title: "The Research Proposal",
        topic: "校园生活",
        targetWordCount: 98,
        readingMinutes: 8,
        status: "done",
        progress: 100,
        isFree: true,
        paragraphs: [
          {
            id: 1,
            sentences: [
              {
                id: "1-1",
                en: "Sarah stared at her blank computer screen, wondering how to begin her research proposal.",
                zh: "Sarah 盯着空白的电脑屏幕，不知道该如何开始她的研究计划。",
                targetWords: ["blank", "research", "proposal"],
              },
              {
                id: "1-2",
                en: "The assignment seemed simple at first, but the deadline made every choice feel urgent.",
                zh: "这个作业起初看起来很简单，但截止日期让每个选择都显得很紧迫。",
                targetWords: ["assignment", "deadline", "urgent"],
              },
              {
                id: "1-3",
                en: "She wanted to submit a clear argument instead of a loose collection of notes.",
                zh: "她想提交一份论点清晰的作品，而不是一堆松散的笔记。",
                targetWords: ["submit", "argument", "collection"],
              },
            ],
          },
          {
            id: 2,
            sentences: [
              {
                id: "2-1",
                en: "Her roommate Chen appeared at the door with a calm smile and a cup of tea.",
                zh: "她的室友 Chen 端着一杯茶，带着平静的微笑出现在门口。",
                targetWords: ["roommate", "appeared", "calm"],
              },
              {
                id: "2-2",
                en: "Chen suggested that Sarah divide the project into small sections and handle one section at a time.",
                zh: "Chen 建议 Sarah 把项目拆成几个小部分，一次处理一个部分。",
                targetWords: ["suggested", "divide", "sections", "handle"],
              },
              {
                id: "2-3",
                en: "That practical method reduced Sarah's anxiety and helped her focus on the first paragraph.",
                zh: "这个实用的方法减轻了 Sarah 的焦虑，也帮助她专注于第一段。",
                targetWords: ["practical", "reduced", "anxiety", "focus"],
              },
            ],
          },
          {
            id: 3,
            sentences: [
              {
                id: "3-1",
                en: "By midnight, the proposal had a strong structure, a careful summary, and a realistic plan.",
                zh: "到午夜时，这份计划已经有了清晰的结构、仔细的摘要和现实可行的方案。",
                targetWords: ["structure", "summary", "realistic"],
              },
              {
                id: "3-2",
                en: "Sarah realized that discipline was not a talent but a series of small decisions.",
                zh: "Sarah 意识到，自律不是一种天赋，而是一连串小决定。",
                targetWords: ["realized", "discipline", "talent", "series"],
              },
            ],
          },
        ],
      },
      {
        id: "cet4-002",
        courseId: "cet4",
        index: 2,
        title: "The First Interview",
        topic: "职场与经济",
        targetWordCount: 101,
        readingMinutes: 8,
        status: "reading",
        progress: 56,
        isFree: true,
        paragraphs: [
          {
            id: 1,
            sentences: [
              {
                id: "1-1",
                en: "Daniel entered the company lobby and tried to appear confident before his first interview.",
                zh: "Daniel 走进公司大厅，努力在第一次面试前显得自信。",
                targetWords: ["company", "appear", "confident", "interview"],
              },
              {
                id: "1-2",
                en: "He had prepared examples that showed his ability to cooperate under pressure.",
                zh: "他准备了一些例子，展示自己在压力下合作的能力。",
                targetWords: ["prepared", "ability", "cooperate", "pressure"],
              },
            ],
          },
        ],
      },
      {
        id: "cet4-003",
        courseId: "cet4",
        index: 3,
        title: "A Journey Through Old Streets",
        topic: "文化与旅游",
        targetWordCount: 96,
        readingMinutes: 7,
        status: "unread",
        progress: 0,
        isFree: true,
        paragraphs: [
          {
            id: 1,
            sentences: [
              {
                id: "1-1",
                en: "Mina followed a narrow route through the ancient district and recorded every detail in her notebook.",
                zh: "Mina 沿着一条狭窄路线穿过古老街区，并把每个细节记录在笔记本里。",
                targetWords: ["route", "ancient", "district", "recorded", "detail"],
              },
            ],
          },
        ],
      },
      {
        id: "cet4-004",
        courseId: "cet4",
        index: 4,
        title: "The Campus Robot",
        topic: "科技与创新",
        targetWordCount: 103,
        readingMinutes: 8,
        status: "unread",
        progress: 0,
        isFree: true,
        paragraphs: [
          {
            id: 1,
            sentences: [
              {
                id: "1-1",
                en: "The engineering team designed a device that could deliver books across the campus library.",
                zh: "工程团队设计了一台能在校园图书馆内运送书籍的设备。",
                targetWords: ["engineering", "designed", "device", "deliver", "campus"],
              },
            ],
          },
        ],
      },
      {
        id: "cet4-005",
        courseId: "cet4",
        index: 5,
        title: "A Quiet Recovery",
        topic: "健康与生活",
        targetWordCount: 99,
        readingMinutes: 8,
        status: "unread",
        progress: 0,
        isFree: true,
        paragraphs: [
          {
            id: 1,
            sentences: [
              {
                id: "1-1",
                en: "After the accident, Julia followed a regular routine to rebuild her strength and confidence.",
                zh: "事故后，Julia 按照规律的日程恢复体力和信心。",
                targetWords: ["accident", "regular", "routine", "rebuild", "strength"],
              },
            ],
          },
        ],
      },
      {
        id: "cet4-006",
        courseId: "cet4",
        index: 6,
        title: "The Boundary of Artificial Intelligence",
        topic: "科技与创新",
        targetWordCount: 100,
        readingMinutes: 9,
        status: "locked",
        progress: 0,
        isFree: false,
        paragraphs: [],
      },
    ],
  },
];

export const dictEntries: Record<string, DictEntry> = {
  blank: {
    word: "blank",
    phonetic: "/blæŋk/",
    pos: "adj.",
    definitions: ["空白的", "茫然的"],
    etymology: "来自古法语 blanc，表示白色或空白。",
    examples: [
      { en: "She wrote her name on a blank page.", zh: "她在一张空白页上写下名字。" },
      { en: "His mind went blank before the exam.", zh: "考试前他脑子一片空白。" },
    ],
  },
  research: {
    word: "research",
    phonetic: "/rɪˈsɝːtʃ/",
    pos: "n./v.",
    definitions: ["研究", "调查"],
    examples: [
      { en: "The team began research on clean energy.", zh: "团队开始研究清洁能源。" },
    ],
  },
  proposal: {
    word: "proposal",
    phonetic: "/prəˈpoʊzl/",
    pos: "n.",
    definitions: ["提议", "计划书"],
    examples: [
      { en: "Her proposal was accepted by the professor.", zh: "她的计划书被教授接受了。" },
    ],
  },
  deadline: {
    word: "deadline",
    phonetic: "/ˈdedlaɪn/",
    pos: "n.",
    definitions: ["截止日期", "最后期限"],
    examples: [
      { en: "We must finish the report before the deadline.", zh: "我们必须在截止日期前完成报告。" },
    ],
  },
  discipline: {
    word: "discipline",
    phonetic: "/ˈdɪsəplɪn/",
    pos: "n.",
    definitions: ["自律", "纪律", "学科"],
    examples: [
      { en: "Discipline helped him keep studying every day.", zh: "自律帮助他每天坚持学习。" },
    ],
  },
};

export function getCourse(courseId: string) {
  return courses.find((course) => course.id === courseId);
}

export function getArticle(articleId: string) {
  return courses.flatMap((course) => course.articles).find((article) => article.id === articleId);
}

export function getDictEntry(word: string) {
  return dictEntries[word.toLowerCase()];
}
