# Phase 4 · 技术架构文档

> **项目名称**：词境（WordScape）
> **文档版本**：v1.0
> **阶段**：技术架构
> **技术栈**：Next.js + FastAPI + Supabase + Vercel/Railway

---

## 目录

1. [整体架构概览](#1-整体架构概览)
2. [前端架构](#2-前端架构)
3. [后端架构](#3-后端架构)
4. [数据库设计](#4-数据库设计)
5. [AI 集成方案](#5-ai-集成方案)
6. [TTS 语音方案](#6-tts-语音方案)
7. [认证与权限](#7-认证与权限)
8. [部署架构](#8-部署架构)
9. [项目目录结构](#9-项目目录结构)
10. [关键接口定义](#10-关键接口定义)

---

## 1. 整体架构概览

### 1.1 架构图

```
┌─────────────────────────────────────────────────────┐
│                    用户设备（浏览器）                  │
│                                                     │
│   Next.js 前端（Vercel）                             │
│   ┌─────────────────────────────────────────────┐   │
│   │  Pages / Components / Hooks / Stores        │   │
│   │  Tailwind CSS + shadcn/ui                   │   │
│   └──────────┬────────────────┬─────────────────┘   │
└──────────────┼────────────────┼─────────────────────┘
               │                │
        REST API         Supabase Client
        调用后端          直连数据库/Auth
               │                │
               ▼                ▼
┌──────────────────┐   ┌─────────────────────────────┐
│  FastAPI 后端     │   │  Supabase                   │
│  （Railway）      │   │  ┌─────────┐ ┌───────────┐  │
│                  │   │  │ PostgreSQL│ │   Auth    │  │
│  /api/generate   │   │  │ （数据库）│ │ （认证）   │  │
│  /api/vocab      │   │  └─────────┘ └───────────┘  │
│  /api/dict       │   │  ┌─────────┐ ┌───────────┐  │
│  /api/courses    │   │  │ Storage │ │  Realtime │  │
│                  │   │  │ （文件） │ │ （实时订阅）│  │
│  BackgroundTasks │   │  └─────────┘ └───────────┘  │
└──────┬───────────┘   └─────────────────────────────┘
       │
       │ OpenAI 兼容接口
       ▼
┌─────────────────┐
│  AI 模型服务     │
│  （用户自配置）  │
│                 │
│  OpenAI         │
│  DeepSeek       │
│  DashScope      │
│  月之暗面        │
│  本地 Ollama     │
└─────────────────┘
```

### 1.2 数据流说明

| 操作 | 数据流路径 |
|------|----------|
| 用户登录 | 前端 → Supabase Auth（直连） |
| 读取文章 | 前端 → Supabase DB（直连，Row Level Security 控制权限） |
| 生成课程 | 前端 → FastAPI → AI 模型 → 写入 Supabase DB |
| 查看生成进度 | 前端 → Supabase Realtime 订阅（实时推送） |
| 词典查词 | 前端 → Supabase DB（直连，词典数据预存） |
| 保存生词本 | 前端 → Supabase DB（直连） |

### 1.3 为什么前端直连 Supabase

- 读操作（文章、词典、进度）无需经过后端，减少延迟
- Supabase Row Level Security（RLS）确保数据安全
- 后端只承担需要 AI 调用的重型任务
- 前端代码更简洁，减少 API 层级

---

## 2. 前端架构

### 2.1 技术选型

```
框架：     Next.js 14（App Router）
语言：     TypeScript
样式：     Tailwind CSS v3
组件库：   shadcn/ui（按需引入，非全量）
状态管理： Zustand（轻量，够用）
数据请求： TanStack Query（缓存 + 同步）
数据库SDK：@supabase/supabase-js
表单：     React Hook Form + Zod（校验）
动效：     Framer Motion（关键动效）
字体：     next/font（Lora + Noto Sans SC）
图标：     Lucide React
```

### 2.2 目录结构

```
frontend/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # 落地页路由组（无需登录）
│   │   ├── page.tsx              # 首页
│   │   └── pricing/page.tsx      # 定价页
│   ├── (app)/                    # 主应用路由组（需登录）
│   │   ├── layout.tsx            # 带导航的布局
│   │   ├── library/              # 词库中心
│   │   │   ├── page.tsx
│   │   │   └── new/page.tsx      # 新建词库
│   │   ├── courses/              # 课程中心
│   │   │   ├── page.tsx
│   │   │   └── [courseId]/page.tsx
│   │   ├── read/                 # 阅读器
│   │   │   └── [articleId]/page.tsx
│   │   ├── wordbook/page.tsx     # 生词本
│   │   ├── stats/page.tsx        # 统计
│   │   └── settings/             # 设置
│   │       ├── page.tsx
│   │       ├── model/page.tsx    # 模型配置
│   │       └── account/page.tsx
│   ├── api/                      # Next.js API Routes（轻量代理）
│   │   └── generate/route.ts     # 转发生成请求到 FastAPI
│   ├── layout.tsx                # 根布局
│   └── globals.css               # 全局样式 + CSS 变量
│
├── components/
│   ├── ui/                       # shadcn/ui 基础组件
│   ├── reader/                   # 阅读器相关组件
│   │   ├── ArticleContent.tsx    # 文章正文渲染
│   │   ├── ChinesePanel.tsx      # 中文对照面板
│   │   ├── DictCard.tsx          # 词典卡片
│   │   ├── HighlightWord.tsx     # 目标词高亮
│   │   ├── SentenceBlock.tsx     # 句子交互块
│   │   └── ReadingProgress.tsx   # 进度条
│   ├── library/                  # 词库相关组件
│   │   ├── VocabImporter.tsx     # 词汇导入组件
│   │   ├── LibraryCard.tsx       # 词库卡片
│   │   └── GenerationProgress.tsx# 生成进度
│   ├── course/
│   │   ├── ArticleCard.tsx       # 文章列表卡片
│   │   └── CourseProgress.tsx    # 课程进度
│   └── layout/
│       ├── BottomNav.tsx         # 手机底部导航
│       └── Sidebar.tsx           # PC 侧边栏
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # 浏览器端 Supabase client
│   │   ├── server.ts             # 服务端 Supabase client
│   │   └── queries.ts            # 常用查询封装
│   ├── api.ts                    # FastAPI 调用封装
│   ├── tts.ts                    # TTS 工具函数
│   └── utils.ts                  # 通用工具
│
├── hooks/
│   ├── useReader.ts              # 阅读器状态逻辑
│   ├── useDict.ts                # 词典查询
│   ├── useGeneration.ts          # 生成进度订阅
│   └── useWordbook.ts            # 生词本操作
│
├── stores/
│   ├── readerStore.ts            # 阅读器全局状态（Zustand）
│   ├── settingsStore.ts          # 用户设置（含模型配置）
│   └── wordbookStore.ts          # 生词本本地缓存
│
└── types/
    ├── article.ts                # 文章相关类型
    ├── vocab.ts                  # 词汇相关类型
    └── user.ts                   # 用户相关类型
```

### 2.3 关键状态管理

**settingsStore（持久化到 localStorage）**
```typescript
interface SettingsStore {
  // 模型配置
  modelConfig: {
    baseUrl: string       // https://api.openai.com/v1
    apiKey: string        // sk-xxx（加密存储）
    modelName: string     // gpt-4o-mini
    maxTokens: number     // 4096
    temperature: number   // 0.8
  }
  // 阅读偏好
  readingPrefs: {
    fontSize: 'sm' | 'md' | 'lg'
    chineseMode: 'always' | 'click' | 'hidden'
    highlightEnabled: boolean
    ttsSpeed: number
    ttsAccent: 'us' | 'uk'
  }
}
```

**readerStore（页面级，不持久化）**
```typescript
interface ReaderStore {
  currentArticle: Article | null
  activeSentenceId: string | null   // 当前朗读句
  activeWordId: string | null       // 当前弹词典的词
  dictCardOpen: boolean
  isSpeaking: boolean
  scrollProgress: number            // 0–100
}
```

---

## 3. 后端架构

### 3.1 技术选型

```
框架：     FastAPI 0.110+
语言：     Python 3.11+
AI 调用：  openai SDK（兼容任意 OpenAI 格式接口）
任务队列： FastAPI BackgroundTasks（MVP）
词频数据： wordfreq 库（Python，离线词频查询）
数据库：   supabase-py（写入 Supabase）
配置管理： pydantic-settings
日志：     loguru
```

### 3.2 目录结构

```
backend/
├── app/
│   ├── main.py                   # FastAPI 入口，路由注册
│   ├── config.py                 # 环境变量配置（pydantic-settings）
│   ├── dependencies.py           # 依赖注入（Auth 验证等）
│   │
│   ├── routers/
│   │   ├── generate.py           # 课程生成接口
│   │   ├── vocab.py              # 词汇处理接口
│   │   ├── dict.py               # 词典查询接口
│   │   └── health.py             # 健康检查
│   │
│   ├── services/
│   │   ├── generation/
│   │   │   ├── pipeline.py       # 生成总流程编排
│   │   │   ├── vocab_processor.py# 词汇清洗、频率标注、聚类
│   │   │   ├── course_planner.py # 课程结构规划（篇数、分配）
│   │   │   ├── article_writer.py # 单篇文章 AI 生成
│   │   │   ├── dict_generator.py # 词典数据批量生成
│   │   │   └── quality_checker.py# 生成质量校验
│   │   ├── tts.py                # TTS 服务封装
│   │   └── ai_client.py          # OpenAI 兼容接口统一封装
│   │
│   ├── models/
│   │   ├── request.py            # 请求体 Pydantic 模型
│   │   └── response.py           # 响应体 Pydantic 模型
│   │
│   └── utils/
│       ├── text.py               # 文本处理工具
│       └── freq.py               # 词频工具（wordfreq 封装）
│
├── prompts/                      # Prompt 模板（独立管理，便于调优）
│   ├── article_generation.txt    # 文章生成 Prompt
│   ├── dict_generation.txt       # 词典生成 Prompt
│   └── topic_clustering.txt      # 话题聚类 Prompt
│
├── data/
│   └── builtin_vocabs/           # 内置词库原始数据
│       ├── cet4.txt
│       ├── cet6.txt
│       ├── senior.txt
│       └── ...
│
├── tests/
├── requirements.txt
├── Dockerfile
└── .env.example
```

### 3.3 核心服务：生成流水线

```python
# services/generation/pipeline.py
# 生成一个完整课程的流程编排

async def generate_course(
    vocab_set_id: str,
    words: list[str],
    config: ModelConfig,
    db: SupabaseClient
):
    # Step 1: 词汇清洗与频率标注
    processed = await vocab_processor.process(words)
    # → 去重、标注词频等级、过滤无效词

    # Step 2: 话题聚类
    clusters = await vocab_processor.cluster_by_topic(
        processed, config
    )
    # → [{"topic": "校园生活", "words": [...]}, ...]

    # Step 3: 课程结构规划
    plan = course_planner.plan(clusters, processed)
    # → [{"article_index": 1, "topic": "...", "target_words": [...], "review_words": [...]}, ...]

    # Step 4: 逐篇生成（顺序执行，确保复现词上下文一致）
    for article_plan in plan:
        # 更新进度到数据库（前端通过 Realtime 实时接收）
        await db.update_generation_progress(vocab_set_id, article_plan.index)

        # AI 生成文章
        article = await article_writer.write(article_plan, config)

        # 质量校验，不通过则重试（最多3次）
        article = await quality_checker.check_and_retry(
            article, article_plan, config, max_retries=3
        )

        # 写入数据库
        await db.insert_article(vocab_set_id, article)

    # Step 5: 批量生成词典数据（并发，速度快）
    await dict_generator.batch_generate(
        all_target_words, config, db
    )

    # Step 6: 标记课程生成完成
    await db.mark_course_ready(vocab_set_id)
```

---

## 4. 数据库设计

### 4.1 表结构

```sql
-- 用户表（Supabase Auth 自动管理 auth.users，此表存扩展信息）
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  is_premium  BOOLEAN DEFAULT FALSE,
  premium_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 词库表
CREATE TABLE public.vocab_sets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id),
  name        TEXT NOT NULL,                    -- "大学英语四级词汇"
  source      TEXT NOT NULL,                    -- 'builtin' | 'custom'
  builtin_id  TEXT,                             -- 'cet4' | 'cet6' | ...
  word_count  INTEGER,                          -- 词汇总数
  article_count INTEGER,                        -- 计划生成篇数
  status      TEXT DEFAULT 'pending',           -- pending|generating|ready|failed
  gen_progress INTEGER DEFAULT 0,               -- 已完成篇数（生成中实时更新）
  settings    JSONB DEFAULT '{}',               -- 难度、风格等配置
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 词汇表（属于某个词库的所有词）
CREATE TABLE public.vocab_words (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_set_id UUID REFERENCES public.vocab_sets(id) ON DELETE CASCADE,
  word        TEXT NOT NULL,
  frequency_rank INTEGER,                       -- 词频等级 1-5（5最高频）
  topic_tags  TEXT[],                           -- ['校园生活', '学术']
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 课程表（一个词库对应一个课程）
CREATE TABLE public.courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_set_id UUID REFERENCES public.vocab_sets(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  total_articles INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 文章表
CREATE TABLE public.articles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  vocab_set_id UUID REFERENCES public.vocab_sets(id),
  index       INTEGER NOT NULL,                 -- 篇章序号 1,2,3...
  title       TEXT NOT NULL,
  topic       TEXT NOT NULL,                    -- 话题分类
  content     JSONB NOT NULL,                   -- 结构化正文（见下方说明）
  target_word_count INTEGER,
  is_free     BOOLEAN DEFAULT FALSE,            -- 前5篇免费
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- content JSONB 结构示例：
-- {
--   "paragraphs": [
--     {
--       "id": 1,
--       "sentences": [
--         {
--           "id": "1-1",
--           "en": "Sarah stared at her blank screen.",
--           "zh": "Sarah 盯着空白的屏幕。",
--           "target_words": ["blank"]
--         }
--       ]
--     }
--   ]
-- }

-- 词典表（所有词的词典数据，跨词库共享）
CREATE TABLE public.dict_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word        TEXT UNIQUE NOT NULL,             -- 词的原形（小写）
  phonetic    TEXT,                             -- /blæŋk/
  pos         TEXT,                             -- adj. / v. / n. ...
  definitions JSONB NOT NULL,                   -- [{meaning, en}, ...]
  etymology   TEXT,                             -- 词根说明
  examples    JSONB NOT NULL,                   -- [{en, zh}, ...]
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 文章中目标词位置表（用于高亮渲染）
CREATE TABLE public.article_target_words (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  word          TEXT NOT NULL,
  sentence_id   TEXT NOT NULL,                  -- "1-1"
  form_used     TEXT NOT NULL                   -- 实际出现形式 "blanked"
);

-- 用户阅读进度表
CREATE TABLE public.reading_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id),
  article_id  UUID REFERENCES public.articles(id),
  status      TEXT DEFAULT 'unread',            -- unread|reading|done
  progress_pct INTEGER DEFAULT 0,               -- 滚动进度 0-100
  last_read_at TIMESTAMPTZ,
  UNIQUE(user_id, article_id)
);

-- 生词本表
CREATE TABLE public.wordbook (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id),
  word        TEXT NOT NULL,
  article_id  UUID REFERENCES public.articles(id),  -- 收藏自哪篇
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word)
);

-- 用户模型配置表（API Key 加密存储）
CREATE TABLE public.model_configs (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id),
  base_url    TEXT,
  api_key_enc TEXT,                             -- AES 加密后的 API Key
  model_name  TEXT,
  max_tokens  INTEGER DEFAULT 4096,
  temperature FLOAT DEFAULT 0.8,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Row Level Security（RLS）策略

```sql
-- vocab_sets: 用户只能看/改自己的词库
ALTER TABLE public.vocab_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_vocab_sets" ON public.vocab_sets
  USING (user_id = auth.uid());

-- articles: 免费文章所有人可读，付费文章需会员
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "free_articles_public" ON public.articles
  FOR SELECT USING (is_free = TRUE);
CREATE POLICY "premium_articles_for_members" ON public.articles
  FOR SELECT USING (
    is_free = FALSE AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND is_premium = TRUE
        AND (premium_until IS NULL OR premium_until > NOW())
    )
  );

-- reading_progress / wordbook: 用户只能操作自己的数据
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_progress" ON public.reading_progress
  USING (user_id = auth.uid());

ALTER TABLE public.wordbook ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_wordbook" ON public.wordbook
  USING (user_id = auth.uid());

-- dict_entries: 所有人可读（公共词典）
ALTER TABLE public.dict_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dict_public_read" ON public.dict_entries
  FOR SELECT USING (TRUE);
```

### 4.3 核心索引

```sql
CREATE INDEX idx_articles_course_id ON public.articles(course_id);
CREATE INDEX idx_articles_vocab_set ON public.articles(vocab_set_id);
CREATE INDEX idx_reading_progress_user ON public.reading_progress(user_id);
CREATE INDEX idx_wordbook_user ON public.wordbook(user_id);
CREATE INDEX idx_article_target_words_article ON public.article_target_words(article_id);
CREATE INDEX idx_dict_entries_word ON public.dict_entries(word);
CREATE INDEX idx_vocab_words_set ON public.vocab_words(vocab_set_id);
```

---

## 5. AI 集成方案

### 5.1 统一 AI 客户端封装

```python
# services/ai_client.py
from openai import AsyncOpenAI

class AIClient:
    """
    统一封装 OpenAI 兼容接口调用。
    用户配置的 base_url + api_key 在每次请求时动态传入，
    支持任意兼容服务商。
    """

    def __init__(self, base_url: str, api_key: str, model: str,
                 max_tokens: int = 4096, temperature: float = 0.8):
        self.client = AsyncOpenAI(
            base_url=base_url,
            api_key=api_key,
        )
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature

    async def chat(self, system: str, user: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return response.choices[0].message.content

    async def chat_json(self, system: str, user: str) -> dict:
        """要求模型返回 JSON，自动解析"""
        content = await self.chat(
            system=system + "\n\nIMPORTANT: Respond with valid JSON only.",
            user=user
        )
        # 清理 markdown 代码块
        content = content.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(content)
```

### 5.2 文章生成 Prompt

```
# prompts/article_generation.txt

SYSTEM:
You are a professional English article writer specializing in creating
reading materials for Chinese college students learning English.
Your task is to write a coherent narrative story in English that
naturally incorporates specific vocabulary words.

RULES (strictly follow all):
1. Total word count: 900–1100 words
2. Include EXACTLY the target words provided, each used ONCE
3. Target words may appear in inflected forms (e.g., "abandon" → "abandoned")
4. All other vocabulary should be at A2–B1 level (common, everyday words)
5. Write as a narrative story: has characters, plot, setting, conflict, resolution
6. Organize into 8–12 paragraphs, 3–6 sentences each
7. The story topic should match the given theme
8. Return ONLY valid JSON, no markdown, no explanation

OUTPUT FORMAT:
{
  "title": "Story Title Here",
  "paragraphs": [
    {
      "id": 1,
      "sentences": [
        {
          "id": "1-1",
          "en": "English sentence here.",
          "zh": "对应中文翻译。",
          "target_words": ["word1", "word2"]
        }
      ]
    }
  ],
  "target_words_used": [
    {"word": "abandon", "form_used": "abandoned", "sentence_id": "1-2"}
  ]
}

USER:
Theme: {topic}
Target words to include ({count} words):
{word_list}

Review words to naturally reuse if possible:
{review_words}
```

### 5.3 话题聚类 Prompt

```
# prompts/topic_clustering.txt

SYSTEM:
You are a vocabulary organization expert. Group the given English words
into thematic clusters based on their semantic meaning and typical usage context.

Return ONLY valid JSON in this format:
{
  "clusters": [
    {
      "topic": "校园生活",
      "topic_en": "Campus Life",
      "words": ["academic", "semester", "curriculum"]
    }
  ]
}

Available topics (use these, add new ones if needed):
校园生活、个人成长、职场与经济、科技与创新、文化与旅游、
健康与生活、社会与时事、自然与环境

USER:
Group these {count} words into thematic clusters:
{word_list}
```

### 5.4 质量校验逻辑

```python
# services/generation/quality_checker.py

def check_article(article: dict, plan: ArticlePlan) -> CheckResult:
    issues = []

    # 1. 词数检查
    total_words = count_words(article)
    if not (900 <= total_words <= 1100):
        issues.append(f"Word count {total_words} out of range [900, 1100]")

    # 2. 目标词覆盖率
    used_words = {w["word"] for w in article["target_words_used"]}
    required_words = set(plan.target_words)
    missing = required_words - used_words
    coverage = len(used_words) / len(required_words)
    if coverage < 0.90:
        issues.append(f"Coverage {coverage:.0%}, missing: {missing}")

    # 3. 目标词密度
    density = len(used_words) / total_words
    if not (0.07 <= density <= 0.13):
        issues.append(f"Density {density:.1%} out of range [7%, 13%]")

    # 4. JSON 结构完整性
    required_fields = ["title", "paragraphs", "target_words_used"]
    for f in required_fields:
        if f not in article:
            issues.append(f"Missing field: {f}")

    return CheckResult(passed=len(issues) == 0, issues=issues)
```

---

## 6. TTS 语音方案

### 6.1 分层策略

```
Level 1（默认）：Web Speech API（浏览器原生）
  - 零成本、零延迟、无需后端
  - 覆盖 Chrome / Safari / Edge
  - 微信内置浏览器支持有限 → 降级提示

Level 2（可配置）：用户自配置 TTS 服务
  - 在设置中填写 TTS API（如 OpenAI TTS、Edge TTS）
  - 音质更好，但有成本

Level 3（降级）：禁用朗读，仅展示文字
  - 浏览器不支持 Web Speech API 时
```

### 6.2 前端 TTS 封装

```typescript
// lib/tts.ts

export class TTSService {
  private synth = window.speechSynthesis
  private utterance: SpeechSynthesisUtterance | null = null

  speak(text: string, options: TTSOptions): void {
    this.stop()
    this.utterance = new SpeechSynthesisUtterance(text)
    this.utterance.rate = options.speed ?? 0.85
    this.utterance.lang = options.accent === 'uk' ? 'en-GB' : 'en-US'

    // 逐词高亮回调
    this.utterance.onboundary = (event) => {
      if (event.name === 'word') {
        options.onWordBoundary?.(event.charIndex, event.charLength)
      }
    }

    this.utterance.onend = () => options.onEnd?.()
    this.synth.speak(this.utterance)
  }

  stop(): void {
    this.synth.cancel()
    this.utterance = null
  }

  get isSupported(): boolean {
    return 'speechSynthesis' in window
  }
}
```

---

## 7. 认证与权限

### 7.1 认证方案

```
认证服务：Supabase Auth
登录方式：
  MVP：邮箱 + 密码
  后期：微信登录（通过 Supabase OAuth 接入）

Session 管理：
  Supabase 自动管理 JWT Token
  Next.js middleware 拦截未登录用户，重定向到登录页
```

### 7.2 Next.js Middleware（路由保护）

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // 需要登录的路由
  const protectedRoutes = ['/library', '/courses', '/read', '/wordbook', '/stats']
  const isProtected = protectedRoutes.some(r => req.nextUrl.pathname.startsWith(r))

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}
```

### 7.3 FastAPI 鉴权

```python
# dependencies.py
from fastapi import Header, HTTPException
from supabase import create_client

async def verify_token(authorization: str = Header(...)) -> dict:
    """验证前端传来的 Supabase JWT Token"""
    token = authorization.replace("Bearer ", "")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    user = supabase.auth.get_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user.user
```

---

## 8. 部署架构

### 8.1 MVP 阶段（零/极低成本）

```
┌─────────────────────────────────────────────┐
│  Vercel（免费）                              │
│  · Next.js 前端                             │
│  · 自动 CI/CD（推送 main 分支即部署）        │
│  · 全球 CDN，国内访问速度一般               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Railway（免费 $5/月额度）                   │
│  · FastAPI 后端                             │
│  · Docker 部署                              │
│  · 自动 HTTPS                               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Supabase（免费）                            │
│  · PostgreSQL 500MB                         │
│  · Auth 50,000 MAU                         │
│  · Realtime 200 并发连接                    │
│  · 免费额度对 MVP 完全够用                  │
└─────────────────────────────────────────────┘
```

### 8.2 环境变量

**前端（.env.local）**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
NEXT_PUBLIC_API_BASE_URL=https://your-api.railway.app
```

**后端（.env）**
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx          # service_role key，后端专用
ENCRYPT_SECRET=your-32-char-secret   # API Key 加密密钥
CORS_ORIGINS=https://your-app.vercel.app
```

### 8.3 Dockerfile（FastAPI）

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 安装 wordfreq 词频数据（离线，约 50MB）
RUN python -c "import wordfreq; wordfreq.word_frequency('test', 'en')"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 8.4 成本预估（MVP 阶段）

| 服务 | 用量 | 费用 |
|------|------|------|
| Vercel | 前端托管 | 免费 |
| Railway | 后端（512MB RAM） | 免费额度（$5/月） |
| Supabase | DB + Auth | 免费 |
| AI 调用 | 用户自带 API Key | 用户承担 |
| TTS | Web Speech API | 免费 |
| **合计** | | **¥0 / 月** |

---

## 9. 项目目录结构（Monorepo）

```
wordscape/
├── frontend/                 # Next.js 前端
├── backend/                  # FastAPI 后端
├── docs/                     # 设计文档（本系列文档）
│   ├── phase1-requirements.md
│   ├── phase2-prd.md
│   ├── phase3-ux-design.md
│   └── phase4-architecture.md
├── .github/
│   └── workflows/
│       ├── frontend.yml      # Vercel 自动部署
│       └── backend.yml       # Railway 自动部署
└── README.md
```

---

## 10. 关键接口定义

### 10.1 课程生成接口

```
POST /api/generate/course
Authorization: Bearer <supabase_jwt>

Request Body:
{
  "vocab_set_id": "uuid",
  "words": ["abandon", "absolute", ...],
  "settings": {
    "difficulty": "intermediate",
    "style": "mixed"
  },
  "model_config": {
    "base_url": "https://api.openai.com/v1",
    "api_key": "sk-xxx",          // 前端传入，后端不存储明文
    "model_name": "gpt-4o-mini",
    "max_tokens": 4096,
    "temperature": 0.8
  }
}

Response 202 Accepted:
{
  "task_id": "uuid",
  "message": "Generation started",
  "estimated_articles": 40
}

// 生成进度通过 Supabase Realtime 订阅 vocab_sets 表的 gen_progress 字段
```

### 10.2 验证模型接口

```
POST /api/generate/verify-model
Authorization: Bearer <supabase_jwt>

Request Body:
{
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-xxx",
  "model_name": "gpt-4o-mini"
}

Response 200:
{ "success": true, "message": "连接成功，模型可用" }

Response 400:
{ "success": false, "message": "API Key 无效", "detail": "401 Unauthorized" }
```

### 10.3 词汇预处理接口

```
POST /api/vocab/preview
Authorization: Bearer <supabase_jwt>

Request Body:
{
  "raw_text": "abandon\nabsolute\nacademic\n..."
}

Response 200:
{
  "valid_words": ["abandon", "absolute", "academic"],
  "invalid_count": 3,
  "estimated_articles": 40,
  "topic_preview": [
    {"topic": "校园生活", "count": 450},
    {"topic": "职场经济", "count": 380}
  ]
}
```

### 10.4 Supabase Realtime 订阅（前端）

```typescript
// hooks/useGeneration.ts
// 订阅生成进度，实时更新 UI

const channel = supabase
  .channel(`generation:${vocabSetId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'vocab_sets',
      filter: `id=eq.${vocabSetId}`
    },
    (payload) => {
      const { gen_progress, status } = payload.new
      setProgress(gen_progress)
      if (status === 'ready') {
        setIsComplete(true)
        channel.unsubscribe()
      }
    }
  )
  .subscribe()
```

---

*文档状态：✅ Phase 4 完成*
*下一步：Phase 5 · 商业模式文档*
