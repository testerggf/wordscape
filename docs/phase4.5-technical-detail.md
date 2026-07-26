# Phase 4.5 · 技术详细设计文档

> **项目名称**：词境（WordScape）
> **文档版本**：v1.0
> **阶段**：技术详细设计
> **依赖**：Phase 4 技术架构文档

---

## 目录

1. [前端详细设计](#1-前端详细设计)
   - 1.1 路由与页面设计
   - 1.2 阅读器核心实现
   - 1.3 词典卡片实现
   - 1.4 词汇导入组件
   - 1.5 生成进度实时订阅
   - 1.6 模型配置页
2. [后端详细设计](#2-后端详细设计)
   - 2.1 FastAPI 入口与中间件
   - 2.2 词汇处理流水线
   - 2.3 课程规划器
   - 2.4 文章生成器
   - 2.5 词典生成器
   - 2.6 质量校验器
3. [数据库详细设计](#3-数据库详细设计)
   - 3.1 完整建表 SQL
   - 3.2 RLS 策略
   - 3.3 常用查询封装
4. [Prompt 详细设计](#4-prompt-详细设计)
5. [类型定义](#5-类型定义)
6. [错误处理规范](#6-错误处理规范)
7. [本地开发启动指南](#7-本地开发启动指南)

---

## 1. 前端详细设计

### 1.1 路由与页面设计

#### Next.js App Router 路由结构

```
app/
├── layout.tsx                    # 根布局：字体、全局 Provider
├── globals.css                   # CSS 变量、Tailwind base
│
├── (marketing)/                  # 无需登录的路由组
│   ├── layout.tsx                # 简单顶部导航
│   ├── page.tsx                  # 首页 Landing
│   └── pricing/
│       └── page.tsx
│
├── (auth)/                       # 认证页面
│   ├── login/page.tsx
│   └── register/page.tsx
│
└── (app)/                        # 需登录的路由组
    ├── layout.tsx                # 带底部 TabBar / 侧边栏的主布局
    ├── library/
    │   ├── page.tsx              # 词库中心
    │   └── new/
    │       └── page.tsx          # 新建词库
    ├── courses/
    │   ├── page.tsx              # 课程列表
    │   └── [courseId]/
    │       └── page.tsx          # 课程文章列表
    ├── read/
    │   └── [articleId]/
    │       └── page.tsx          # 阅读器
    ├── wordbook/
    │   └── page.tsx
    ├── stats/
    │   └── page.tsx
    └── settings/
        ├── page.tsx              # 设置首页
        ├── model/
        │   └── page.tsx          # 模型配置
        └── account/
            └── page.tsx
```

#### 根布局（app/layout.tsx）

```tsx
import { Lora, Noto_Sans_SC } from 'next/font/google'
import { Providers } from '@/components/Providers'

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${lora.variable} ${notoSansSC.variable}`}>
      <body className="bg-neutral-50 text-neutral-900 antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

#### 全局 Provider（components/Providers.tsx）

```tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,  // 5分钟缓存
        retry: 1,
      },
    },
  }))
  const supabaseClient = createClientComponentClient()

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionContextProvider>
  )
}
```

#### App 主布局（app/(app)/layout.tsx）

```tsx
import { BottomNav } from '@/components/layout/BottomNav'
import { Sidebar } from '@/components/layout/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* PC 侧边栏：md 以上显示 */}
      <Sidebar className="hidden md:flex" />

      {/* 主内容区 */}
      <main className="flex-1 pb-16 md:pb-0 md:ml-56">
        {children}
      </main>

      {/* 手机底部导航：md 以下显示 */}
      <BottomNav className="md:hidden" />
    </div>
  )
}
```

---

### 1.2 阅读器核心实现

阅读器是产品最复杂的页面，拆分为以下子组件：

```
read/[articleId]/page.tsx
├── ReaderHeader            顶部导航 + 进度条
├── ArticleContent          文章正文（英文）
│   ├── ParagraphBlock      段落
│   │   └── SentenceBlock   句子（点击朗读）
│   │       └── WordToken   单词（目标词高亮，点击词典）
└── ChinesePanel            中文对照（手机抽屉 / PC 右栏）
```

#### 页面入口（app/(app)/read/[articleId]/page.tsx）

```tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ReaderView } from '@/components/reader/ReaderView'
import { notFound } from 'next/navigation'

interface Props {
  params: { articleId: string }
}

export default async function ReadPage({ params }: Props) {
  const supabase = createServerComponentClient({ cookies })

  // 服务端直接查询，利用 SSR 加速首屏
  const { data: article, error } = await supabase
    .from('articles')
    .select(`
      id, title, topic, index, is_free, content,
      course:courses(id, vocab_set_id),
      target_words:article_target_words(word, sentence_id, form_used)
    `)
    .eq('id', params.articleId)
    .single()

  if (error || !article) notFound()

  // 查询用户阅读进度
  const { data: progress } = await supabase
    .from('reading_progress')
    .select('status, progress_pct')
    .eq('article_id', params.articleId)
    .single()

  return (
    <ReaderView
      article={article}
      initialProgress={progress ?? { status: 'unread', progress_pct: 0 }}
    />
  )
}
```

#### 阅读器状态 Hook（hooks/useReader.ts）

```typescript
import { create } from 'zustand'

interface ReaderState {
  // 当前激活的句子 ID（正在朗读）
  activeSentenceId: string | null
  // 当前打开词典的词
  dictWord: string | null
  // 是否正在朗读
  isSpeaking: boolean
  // 滚动进度 0-100
  scrollProgress: number

  setActiveSentence: (id: string | null) => void
  openDict: (word: string) => void
  closeDict: () => void
  setIsSpeaking: (v: boolean) => void
  setScrollProgress: (v: number) => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  activeSentenceId: null,
  dictWord: null,
  isSpeaking: false,
  scrollProgress: 0,

  setActiveSentence: (id) => set({ activeSentenceId: id }),
  openDict: (word) => set({ dictWord: word }),
  closeDict: () => set({ dictWord: null }),
  setIsSpeaking: (v) => set({ isSpeaking: v }),
  setScrollProgress: (v) => set({ scrollProgress: v }),
}))
```

#### 文章正文组件（components/reader/ArticleContent.tsx）

```tsx
'use client'
import { useReaderStore } from '@/hooks/useReader'
import { SentenceBlock } from './SentenceBlock'
import { useTTS } from '@/hooks/useTTS'
import { useScrollProgress } from '@/hooks/useScrollProgress'
import { useRef } from 'react'
import type { Article } from '@/types/article'

interface Props {
  article: Article
  targetWords: Set<string>  // 目标词集合，用于快速判断
}

export function ArticleContent({ article, targetWords }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { activeSentenceId, setActiveSentence } = useReaderStore()
  const { speak, stop, isSpeaking } = useTTS()

  // 监听滚动，更新进度条
  useScrollProgress(containerRef)

  const handleSentenceClick = (sentenceId: string, enText: string) => {
    if (activeSentenceId === sentenceId && isSpeaking) {
      // 再次点击同一句：停止朗读
      stop()
      setActiveSentence(null)
      return
    }
    setActiveSentence(sentenceId)
    speak(enText, {
      onEnd: () => setActiveSentence(null),
    })
  }

  return (
    <div
      ref={containerRef}
      className="reader-content px-5 py-6 md:px-8 md:py-8 max-w-2xl"
    >
      <h1 className="font-lora text-2xl font-bold text-neutral-900 mb-8">
        {article.title}
      </h1>

      {article.content.paragraphs.map((para) => (
        <div key={para.id} className="mb-6">
          {para.sentences.map((sentence) => (
            <SentenceBlock
              key={sentence.id}
              sentence={sentence}
              isActive={activeSentenceId === sentence.id}
              targetWords={targetWords}
              onClick={() => handleSentenceClick(sentence.id, sentence.en)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
```

#### 句子组件（components/reader/SentenceBlock.tsx）

```tsx
'use client'
import { WordToken } from './WordToken'
import { cn } from '@/lib/utils'
import type { Sentence } from '@/types/article'

interface Props {
  sentence: Sentence
  isActive: boolean
  targetWords: Set<string>
  onClick: () => void
}

export function SentenceBlock({ sentence, isActive, targetWords, onClick }: Props) {
  // 将句子文本拆分为词 token 数组
  const tokens = tokenize(sentence.en)

  return (
    <span
      className={cn(
        'sentence-block cursor-pointer rounded px-0.5 transition-colors duration-200',
        isActive && 'bg-primary-100'
      )}
      onClick={onClick}
    >
      {tokens.map((token, i) => {
        if (token.type === 'word') {
          const isTarget = targetWords.has(token.value.toLowerCase())
          return (
            <WordToken
              key={i}
              word={token.value}
              isTarget={isTarget}
            />
          )
        }
        // 标点和空格原样输出
        return <span key={i}>{token.value}</span>
      })}
      {' '}
    </span>
  )
}

// 将英文句子拆分为 [{type: 'word'|'punct', value: string}]
function tokenize(text: string) {
  const regex = /([a-zA-Z'-]+)|([^a-zA-Z'-]+)/g
  const tokens = []
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) tokens.push({ type: 'word' as const, value: match[1] })
    else tokens.push({ type: 'punct' as const, value: match[2] })
  }
  return tokens
}
```

#### 单词组件（components/reader/WordToken.tsx）

```tsx
'use client'
import { useReaderStore } from '@/hooks/useReader'
import { cn } from '@/lib/utils'

interface Props {
  word: string
  isTarget: boolean
}

export function WordToken({ word, isTarget }: Props) {
  const { openDict } = useReaderStore()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()  // 阻止冒泡到 SentenceBlock
    openDict(word.toLowerCase())
  }

  if (isTarget) {
    return (
      <mark
        className={cn(
          'target-word bg-accent-400/40 border-b-2 border-accent-400',
          'rounded-sm px-0.5 cursor-pointer transition-all duration-150',
          'hover:bg-accent-400/70 hover:-translate-y-px',
          'active:scale-95'
        )}
        onClick={handleClick}
      >
        {word}
      </mark>
    )
  }

  // 普通词：双击触发词典
  return (
    <span
      className="cursor-text hover:bg-neutral-200/50 rounded-sm px-0.5"
      onDoubleClick={handleClick}
    >
      {word}
    </span>
  )
}
```

#### TTS Hook（hooks/useTTS.ts）

```typescript
'use client'
import { useRef, useCallback } from 'react'
import { useReaderStore } from './useReader'
import { useSettingsStore } from '@/stores/settingsStore'

export function useTTS() {
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const { setIsSpeaking } = useReaderStore()
  const { readingPrefs } = useSettingsStore()

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const stop = useCallback(() => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
  }, [setIsSpeaking])

  const speak = useCallback((text: string, callbacks?: {
    onEnd?: () => void
    onWordBoundary?: (charIndex: number, charLength: number) => void
  }) => {
    if (!isSupported) return
    if (!synthRef.current) synthRef.current = window.speechSynthesis

    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = readingPrefs.ttsSpeed
    utterance.lang = readingPrefs.ttsAccent === 'uk' ? 'en-GB' : 'en-US'

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => {
      setIsSpeaking(false)
      callbacks?.onEnd?.()
    }
    utterance.onerror = () => setIsSpeaking(false)
    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        callbacks?.onWordBoundary?.(e.charIndex, e.charLength)
      }
    }

    utteranceRef.current = utterance
    synthRef.current.speak(utterance)
  }, [isSupported, readingPrefs, setIsSpeaking])

  return { speak, stop, isSupported, isSpeaking: false }
}
```

#### 滚动进度 Hook（hooks/useScrollProgress.ts）

```typescript
import { useEffect, RefObject } from 'react'
import { useReaderStore } from './useReader'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useDebounce } from './useDebounce'

export function useScrollProgress(
  containerRef: RefObject<HTMLElement>,
  articleId: string
) {
  const { setScrollProgress, scrollProgress } = useReaderStore()
  const supabase = useSupabaseClient()
  const debouncedProgress = useDebounce(scrollProgress, 2000)

  // 监听滚动，计算进度
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handler = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement
      const progress = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)
      setScrollProgress(Math.min(progress, 100))
    }

    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [containerRef, setScrollProgress])

  // 防抖后写入数据库（避免频繁写入）
  useEffect(() => {
    if (debouncedProgress === 0) return
    const status = debouncedProgress >= 95 ? 'done' : 'reading'

    supabase.from('reading_progress').upsert({
      article_id: articleId,
      status,
      progress_pct: debouncedProgress,
      last_read_at: new Date().toISOString(),
    }, { onConflict: 'user_id,article_id' })
  }, [debouncedProgress, articleId, supabase])
}
```

#### 中文对照面板（components/reader/ChinesePanel.tsx）

```tsx
'use client'
import { useReaderStore } from '@/hooks/useReader'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import type { Article } from '@/types/article'

interface Props {
  article: Article
}

export function ChinesePanel({ article }: Props) {
  const { activeSentenceId } = useReaderStore()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* 手机端：底部固定抽屉 */}
      <div className={cn(
        'md:hidden fixed bottom-14 left-0 right-0 bg-white border-t border-neutral-200',
        'transition-all duration-300 shadow-xl',
        collapsed ? 'h-10' : 'h-[35vh]'
      )}>
        {/* 抽屉头部 */}
        <button
          className="w-full h-10 flex items-center justify-between px-4 text-sm text-neutral-600"
          onClick={() => setCollapsed(!collapsed)}
        >
          <span>中文对照</span>
          <span>{collapsed ? '▲' : '▼'}</span>
        </button>

        {/* 中文内容 */}
        {!collapsed && (
          <div className="overflow-y-auto h-[calc(35vh-2.5rem)] px-4 py-2 font-noto text-sm leading-relaxed">
            <ChineseText article={article} activeSentenceId={activeSentenceId} />
          </div>
        )}
      </div>

      {/* PC 端：右侧固定栏（由父布局控制） */}
      <div className="hidden md:block sticky top-0 h-screen overflow-y-auto px-6 py-8 font-noto text-base leading-relaxed text-neutral-700">
        <ChineseText article={article} activeSentenceId={activeSentenceId} />
      </div>
    </>
  )
}

function ChineseText({ article, activeSentenceId }: {
  article: Article
  activeSentenceId: string | null
}) {
  return (
    <>
      {article.content.paragraphs.map((para) => (
        <p key={para.id} className="mb-4">
          {para.sentences.map((s) => (
            <span
              key={s.id}
              className={cn(
                'transition-colors duration-200',
                activeSentenceId === s.id && 'bg-primary-100 rounded px-0.5'
              )}
            >
              {s.zh}
            </span>
          ))}
        </p>
      ))}
    </>
  )
}
```

---

### 1.3 词典卡片实现

#### 词典查询 Hook（hooks/useDict.ts）

```typescript
import { useQuery } from '@tanstack/react-query'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export function useDict(word: string | null) {
  const supabase = createClientComponentClient()

  return useQuery({
    queryKey: ['dict', word],
    queryFn: async () => {
      if (!word) return null
      const { data, error } = await supabase
        .from('dict_entries')
        .select('*')
        .eq('word', word.toLowerCase())
        .single()

      if (error) throw error
      return data
    },
    enabled: !!word,
    staleTime: Infinity,  // 词典数据永不过期
  })
}
```

#### 词典卡片组件（components/reader/DictCard.tsx）

```tsx
'use client'
import { useReaderStore } from '@/hooks/useReader'
import { useDict } from '@/hooks/useDict'
import { useWordbook } from '@/hooks/useWordbook'
import { useTTS } from '@/hooks/useTTS'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Volume2, Star, StarOff, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export function DictCard() {
  const { dictWord, closeDict } = useReaderStore()
  const { data: entry, isLoading } = useDict(dictWord)
  const { isInWordbook, toggle } = useWordbook(dictWord)
  const { speak } = useTTS()
  const [etymologyOpen, setEtymologyOpen] = useState(false)

  return (
    <>
      {/* 手机端：底部抽屉 */}
      <AnimatePresence>
        {dictWord && (
          <>
            {/* 遮罩 */}
            <motion.div
              className="md:hidden fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDict}
            />

            {/* 抽屉 */}
            <motion.div
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[70vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <DictCardContent
                entry={entry}
                isLoading={isLoading}
                word={dictWord}
                isInWordbook={isInWordbook}
                onClose={closeDict}
                onSpeak={() => speak(dictWord!)}
                onToggleWordbook={toggle}
                etymologyOpen={etymologyOpen}
                onToggleEtymology={() => setEtymologyOpen(!etymologyOpen)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* PC 端：气泡弹层（简化为固定右侧面板）*/}
      <AnimatePresence>
        {dictWord && (
          <motion.div
            className="hidden md:block fixed right-6 top-24 z-50 w-72 bg-white rounded-xl shadow-lg border border-neutral-200"
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <DictCardContent
              entry={entry}
              isLoading={isLoading}
              word={dictWord}
              isInWordbook={isInWordbook}
              onClose={closeDict}
              onSpeak={() => speak(dictWord!)}
              onToggleWordbook={toggle}
              etymologyOpen={etymologyOpen}
              onToggleEtymology={() => setEtymologyOpen(!etymologyOpen)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function DictCardContent({
  entry, isLoading, word,
  isInWordbook, onClose, onSpeak, onToggleWordbook,
  etymologyOpen, onToggleEtymology
}: DictCardContentProps) {
  return (
    <div className="p-5">
      {/* 拖拽条（手机） */}
      <div className="md:hidden w-10 h-1 bg-neutral-300 rounded-full mx-auto mb-4" />

      {/* 标题行 */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-lora text-2xl font-bold text-neutral-900">{word}</span>
          {entry && (
            <span className="ml-2 font-mono text-sm text-neutral-500">{entry.phonetic}</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSpeak}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500"
          >
            <Volume2 size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-4 bg-neutral-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {entry && (
        <>
          {/* 释义 */}
          <div className="space-y-1 mb-4">
            {entry.definitions.map((def: Definition, i: number) => (
              <div key={i} className="text-sm">
                <span className="text-neutral-400 mr-1">{def.pos}</span>
                <span className="text-neutral-800">{def.meaning}</span>
              </div>
            ))}
          </div>

          {/* 词根（可折叠） */}
          {entry.etymology && (
            <div className="mb-4 border-t border-neutral-100 pt-3">
              <button
                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 mb-1"
                onClick={onToggleEtymology}
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform ${etymologyOpen ? 'rotate-180' : ''}`}
                />
                词根词缀
              </button>
              {etymologyOpen && (
                <p className="text-sm text-neutral-600">{entry.etymology}</p>
              )}
            </div>
          )}

          {/* 例句 */}
          <div className="border-t border-neutral-100 pt-3 space-y-3 mb-4">
            {entry.examples.map((ex: Example, i: number) => (
              <div key={i} className="text-sm">
                <p className="text-neutral-800 italic">{ex.en}</p>
                <p className="text-neutral-500 mt-0.5">{ex.zh}</p>
              </div>
            ))}
          </div>

          {/* 操作按钮 */}
          <button
            onClick={onToggleWordbook}
            className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              isInWordbook
                ? 'bg-primary-100 text-primary-800'
                : 'bg-primary-800 text-white hover:bg-primary-700'
            }`}
          >
            {isInWordbook
              ? <><StarOff size={16} /> 已加入生词本</>
              : <><Star size={16} /> 加入生词本</>
            }
          </button>
        </>
      )}
    </div>
  )
}
```

---

### 1.4 词汇导入组件（components/library/VocabImporter.tsx）

```tsx
'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

type Step = 'input' | 'preview' | 'generating'

export function VocabImporter() {
  const [step, setStep] = useState<Step>('input')
  const [vocabName, setVocabName] = useState('')
  const [rawText, setRawText] = useState('')
  const [preview, setPreview] = useState<VocabPreview | null>(null)
  const router = useRouter()

  // 文件拖拽上传
  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => setRawText(e.target?.result as string)
    reader.readAsText(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'], 'text/csv': ['.csv'] },
    maxFiles: 1,
  })

  // 预览请求
  const previewMutation = useMutation({
    mutationFn: () => api.post('/api/vocab/preview', { raw_text: rawText }),
    onSuccess: (data) => {
      setPreview(data)
      setStep('preview')
    },
  })

  // 生成请求
  const generateMutation = useMutation({
    mutationFn: (vocabSetId: string) =>
      api.post('/api/generate/course', {
        vocab_set_id: vocabSetId,
        words: preview!.valid_words,
        settings: { difficulty: 'intermediate', style: 'mixed' },
        model_config: getModelConfig(),  // 从 settingsStore 读取
      }),
    onSuccess: (data) => {
      router.push(`/courses/${data.course_id}`)
    },
  })

  // Step 1: 输入
  if (step === 'input') {
    return (
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            词库名称
          </label>
          <input
            type="text"
            value={vocabName}
            onChange={(e) => setVocabName(e.target.value)}
            placeholder="例：托福备考词汇"
            className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            导入词汇
          </label>

          {/* 拖拽上传区 */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-4 text-center mb-3 cursor-pointer transition-colors ${
              isDragActive ? 'border-primary-400 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-sm text-neutral-500">
              拖拽 .txt / .csv 文件到此处，或{' '}
              <span className="text-primary-700 underline">点击上传</span>
            </p>
          </div>

          {/* 文本粘贴 */}
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={'直接粘贴单词列表，每行一个：\nabandon\nabsolute\nacademic\n...'}
            rows={10}
            className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
          />
          <p className="text-xs text-neutral-400 mt-1">
            已输入约 {rawText.split('\n').filter(Boolean).length} 行
          </p>
        </div>

        <button
          onClick={() => previewMutation.mutate()}
          disabled={!vocabName || !rawText || previewMutation.isPending}
          className="w-full py-3 bg-primary-800 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {previewMutation.isPending ? '分析中…' : '预览课程结构 →'}
        </button>
      </div>
    )
  }

  // Step 2: 预览
  if (step === 'preview' && preview) {
    return (
      <div className="space-y-5">
        <div className="bg-neutral-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">有效词汇</span>
            <span className="font-medium">{preview.valid_words.length} 个</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">预计生成</span>
            <span className="font-medium">{preview.estimated_articles} 篇文章</span>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-neutral-700 mb-2">话题分布</p>
          <div className="space-y-2">
            {preview.topic_preview.map((t) => (
              <div key={t.topic} className="flex items-center gap-2 text-sm">
                <span className="text-neutral-600 w-20 shrink-0">{t.topic}</span>
                <div className="flex-1 bg-neutral-100 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full"
                    style={{ width: `${(t.count / preview.valid_words.length) * 100}%` }}
                  />
                </div>
                <span className="text-neutral-400 w-12 text-right">{t.count}词</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep('input')}
            className="flex-1 py-3 border border-neutral-200 rounded-xl text-sm hover:bg-neutral-50"
          >
            返回修改
          </button>
          <button
            onClick={() => generateMutation.mutate('new-vocab-set-id')}
            disabled={generateMutation.isPending}
            className="flex-1 py-3 bg-primary-800 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            开始生成课程
          </button>
        </div>
      </div>
    )
  }

  return null
}
```

---

### 1.5 生成进度实时订阅（hooks/useGeneration.ts）

```typescript
import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

interface GenerationState {
  status: 'pending' | 'generating' | 'ready' | 'failed'
  progress: number        // 已完成篇数
  totalArticles: number   // 总篇数
}

export function useGeneration(vocabSetId: string) {
  const supabase = useSupabaseClient()
  const [state, setState] = useState<GenerationState>({
    status: 'pending',
    progress: 0,
    totalArticles: 0,
  })

  useEffect(() => {
    if (!vocabSetId) return

    // 先查一次当前状态
    supabase
      .from('vocab_sets')
      .select('status, gen_progress, article_count')
      .eq('id', vocabSetId)
      .single()
      .then(({ data }) => {
        if (data) {
          setState({
            status: data.status,
            progress: data.gen_progress,
            totalArticles: data.article_count ?? 0,
          })
        }
      })

    // 实时订阅变化
    const channel = supabase
      .channel(`vocab_set:${vocabSetId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vocab_sets',
          filter: `id=eq.${vocabSetId}`,
        },
        (payload) => {
          const { status, gen_progress, article_count } = payload.new
          setState({
            status,
            progress: gen_progress,
            totalArticles: article_count ?? 0,
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [vocabSetId, supabase])

  const progressPercent = state.totalArticles > 0
    ? Math.round((state.progress / state.totalArticles) * 100)
    : 0

  return { ...state, progressPercent }
}
```

---

### 1.6 模型配置页（app/(app)/settings/model/page.tsx）

```tsx
'use client'
import { useSettingsStore } from '@/stores/settingsStore'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react'

const PRESETS = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: 'DashScope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { label: '月之暗面', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { label: 'Ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3' },
]

export default function ModelSettingsPage() {
  const { modelConfig, setModelConfig } = useSettingsStore()
  const [showKey, setShowKey] = useState(false)
  const [verifyResult, setVerifyResult] = useState<'success' | 'error' | null>(null)
  const [verifyMessage, setVerifyMessage] = useState('')

  const verifyMutation = useMutation({
    mutationFn: () => api.post('/api/generate/verify-model', modelConfig),
    onSuccess: (data) => {
      setVerifyResult('success')
      setVerifyMessage(data.message)
    },
    onError: (err: any) => {
      setVerifyResult('error')
      setVerifyMessage(err.message ?? '连接失败')
    },
  })

  return (
    <div className="max-w-lg mx-auto px-5 py-6">
      <h1 className="text-xl font-semibold text-neutral-900 mb-6">AI 模型配置</h1>

      {/* 快速预设 */}
      <div className="mb-6">
        <p className="text-sm text-neutral-500 mb-2">快速选择服务商</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setModelConfig({ ...modelConfig, baseUrl: p.baseUrl, modelName: p.model })}
              className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 配置表单 */}
      <div className="space-y-4">
        <FormField label="Base URL">
          <input
            value={modelConfig.baseUrl}
            onChange={(e) => setModelConfig({ ...modelConfig, baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
            className="input-base"
          />
        </FormField>

        <FormField label="API Key">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={modelConfig.apiKey}
              onChange={(e) => setModelConfig({ ...modelConfig, apiKey: e.target.value })}
              placeholder="sk-..."
              className="input-base pr-10"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FormField>

        <FormField label="模型名称">
          <input
            value={modelConfig.modelName}
            onChange={(e) => setModelConfig({ ...modelConfig, modelName: e.target.value })}
            placeholder="gpt-4o-mini"
            className="input-base"
          />
        </FormField>

        {/* 高级选项（折叠） */}
        <details className="group">
          <summary className="text-sm text-neutral-500 cursor-pointer list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            高级选项
          </summary>
          <div className="mt-3 space-y-3 pl-4">
            <FormField label={`最大 Token：${modelConfig.maxTokens}`}>
              <input
                type="range" min="1024" max="8192" step="512"
                value={modelConfig.maxTokens}
                onChange={(e) => setModelConfig({ ...modelConfig, maxTokens: +e.target.value })}
                className="w-full"
              />
            </FormField>
            <FormField label={`温度（Temperature）：${modelConfig.temperature}`}>
              <input
                type="range" min="0.1" max="1.5" step="0.1"
                value={modelConfig.temperature}
                onChange={(e) => setModelConfig({ ...modelConfig, temperature: +e.target.value })}
                className="w-full"
              />
            </FormField>
          </div>
        </details>
      </div>

      {/* 验证结果 */}
      {verifyResult && (
        <div className={`mt-4 flex items-center gap-2 text-sm p-3 rounded-xl ${
          verifyResult === 'success'
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-700'
        }`}>
          {verifyResult === 'success'
            ? <CheckCircle size={16} />
            : <XCircle size={16} />
          }
          {verifyMessage}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => verifyMutation.mutate()}
          disabled={verifyMutation.isPending || !modelConfig.baseUrl || !modelConfig.apiKey}
          className="flex-1 py-2.5 border border-primary-800 text-primary-800 rounded-xl text-sm font-medium hover:bg-primary-50 disabled:opacity-50"
        >
          {verifyMutation.isPending ? '验证中…' : '✦ 验证连接'}
        </button>
        <button
          onClick={() => { /* 已通过 zustand persist 自动保存 */ }}
          className="flex-1 py-2.5 bg-primary-800 text-white rounded-xl text-sm font-medium hover:bg-primary-700"
        >
          保存配置
        </button>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
```

---

## 2. 后端详细设计

### 2.1 FastAPI 入口（app/main.py）

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import generate, vocab, health
from app.config import settings

app = FastAPI(
    title="WordScape API",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,  # 生产环境关闭文档
)

# CORS：只允许前端域名
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate.router, prefix="/api/generate", tags=["generate"])
app.include_router(vocab.router, prefix="/api/vocab", tags=["vocab"])
app.include_router(health.router, prefix="/api", tags=["health"])
```

### 2.2 配置（app/config.py）

```python
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    encrypt_secret: str          # 32位，用于加密 API Key
    cors_origins: List[str] = ["http://localhost:3000"]
    debug: bool = False

    class Config:
        env_file = ".env"

settings = Settings()
```

### 2.3 词汇处理流水线（services/generation/vocab_processor.py）

```python
import re
from wordfreq import word_frequency
from app.services.ai_client import AIClient
from app.utils.text import clean_word
import json

class VocabProcessor:

    def process(self, raw_words: list[str]) -> list[dict]:
        """
        清洗词汇列表，标注词频。
        返回：[{"word": "abandon", "freq_rank": 3}, ...]
        """
        seen = set()
        result = []

        for raw in raw_words:
            word = clean_word(raw)
            if not word or word in seen:
                continue
            if not re.match(r'^[a-zA-Z\'-]{2,}$', word):
                continue  # 过滤非英文词

            seen.add(word)
            freq = word_frequency(word, 'en')
            freq_rank = self._freq_to_rank(freq)
            result.append({"word": word, "freq_rank": freq_rank})

        # 按词频降序排列（高频词排前面，用于分层法）
        result.sort(key=lambda x: x["freq_rank"], reverse=True)
        return result

    def _freq_to_rank(self, freq: float) -> int:
        """将 wordfreq 频率值转换为 1-5 等级"""
        if freq >= 1e-4:  return 5  # 极高频
        if freq >= 1e-5:  return 4  # 高频
        if freq >= 1e-6:  return 3  # 中频
        if freq >= 1e-7:  return 2  # 低频
        return 1                    # 极低频

    async def cluster_by_topic(
        self, words: list[dict], ai_client: AIClient
    ) -> list[dict]:
        """
        调用 AI 将词汇按话题聚类。
        返回：[{"topic": "校园生活", "topic_en": "Campus Life", "words": [...]}, ...]
        """
        word_list = [w["word"] for w in words]
        word_str = "\n".join(word_list)

        prompt_template = open("prompts/topic_clustering.txt").read()
        result = await ai_client.chat_json(
            system=prompt_template,
            user=f"Group these {len(word_list)} words into thematic clusters:\n{word_str}"
        )
        return result["clusters"]
```

### 2.4 课程规划器（services/generation/course_planner.py）

```python
from dataclasses import dataclass

TARGET_WORDS_PER_ARTICLE = 100
REVIEW_WORDS_PER_ARTICLE = 20   # 每篇复现的旧词数量

@dataclass
class ArticlePlan:
    index: int
    topic: str
    topic_en: str
    target_words: list[str]      # 本篇新词
    review_words: list[str]      # 本篇复现词

class CoursePlanner:

    def plan(self, clusters: list[dict], all_words: list[dict]) -> list[ArticlePlan]:
        """
        根据话题聚类结果，规划每篇文章的词汇分配。
        """
        plans = []
        article_index = 1
        word_history: list[str] = []  # 已在前文出现的词（用于复现）

        for cluster in clusters:
            topic_words = cluster["words"]

            # 将话题词切分为每篇 TARGET_WORDS_PER_ARTICLE 个
            for chunk_start in range(0, len(topic_words), TARGET_WORDS_PER_ARTICLE):
                chunk = topic_words[chunk_start: chunk_start + TARGET_WORDS_PER_ARTICLE]

                # 从历史词中选取复现词（选词频较高的）
                review = self._pick_review_words(word_history, REVIEW_WORDS_PER_ARTICLE)

                plans.append(ArticlePlan(
                    index=article_index,
                    topic=cluster["topic"],
                    topic_en=cluster["topic_en"],
                    target_words=chunk,
                    review_words=review,
                ))

                word_history.extend(chunk)
                article_index += 1

        # 最后追加综合复现篇（取所有词中低频词）
        review_plans = self._create_review_articles(all_words, word_history, article_index)
        plans.extend(review_plans)

        return plans

    def _pick_review_words(self, history: list[str], n: int) -> list[str]:
        """从历史词汇中随机选取 n 个用于复现"""
        import random
        if len(history) <= n:
            return history[:]
        return random.sample(history, n)

    def _create_review_articles(
        self, all_words: list[dict], history: list[str], start_index: int
    ) -> list[ArticlePlan]:
        """生成综合复现篇（最后5篇），专攻低频词汇"""
        low_freq_words = [
            w["word"] for w in all_words
            if w["freq_rank"] <= 2 and w["word"] in history
        ]

        plans = []
        for i, chunk_start in enumerate(range(0, min(len(low_freq_words), 500), 100)):
            chunk = low_freq_words[chunk_start: chunk_start + 100]
            plans.append(ArticlePlan(
                index=start_index + i,
                topic="综合复现",
                topic_en="Comprehensive Review",
                target_words=chunk,
                review_words=self._pick_review_words(history, 20),
            ))
        return plans
```

### 2.5 文章生成器（services/generation/article_writer.py）

```python
import json
from app.services.ai_client import AIClient
from app.services.generation.course_planner import ArticlePlan

ARTICLE_PROMPT_TEMPLATE = open("prompts/article_generation.txt").read()

class ArticleWriter:

    async def write(self, plan: ArticlePlan, ai_client: AIClient) -> dict:
        """
        调用 AI 生成单篇文章。
        返回符合 content JSONB 格式的字典。
        """
        word_list = "\n".join(plan.target_words)
        review_list = ", ".join(plan.review_words) if plan.review_words else "（无）"

        result = await ai_client.chat_json(
            system=ARTICLE_PROMPT_TEMPLATE,
            user=(
                f"Theme: {plan.topic}（{plan.topic_en}）\n"
                f"Target words to include ({len(plan.target_words)} words):\n{word_list}\n\n"
                f"Review words to naturally reuse if possible:\n{review_list}"
            )
        )

        return result

    def extract_target_word_positions(self, article: dict) -> list[dict]:
        """
        从生成结果中提取目标词位置，用于写入 article_target_words 表。
        """
        return [
            {
                "word": item["word"],
                "sentence_id": item["sentence_id"],
                "form_used": item["form_used"],
            }
            for item in article.get("target_words_used", [])
        ]
```

### 2.6 质量校验器（services/generation/quality_checker.py）

```python
import re
from dataclasses import dataclass
from app.services.generation.course_planner import ArticlePlan

@dataclass
class CheckResult:
    passed: bool
    issues: list[str]

class QualityChecker:

    def check(self, article: dict, plan: ArticlePlan) -> CheckResult:
        issues = []

        # 1. JSON 结构完整性
        for field in ["title", "paragraphs", "target_words_used"]:
            if field not in article:
                issues.append(f"缺少字段: {field}")
                return CheckResult(passed=False, issues=issues)  # 结构错误直接返回

        # 2. 词数检查
        total_words = self._count_words(article)
        if not (850 <= total_words <= 1150):
            issues.append(f"词数 {total_words} 超出范围 [850, 1150]")

        # 3. 目标词覆盖率
        used = {item["word"].lower() for item in article["target_words_used"]}
        required = {w.lower() for w in plan.target_words}
        missing = required - used
        coverage = len(used & required) / len(required) if required else 1.0
        if coverage < 0.88:
            issues.append(f"目标词覆盖率 {coverage:.0%}，缺失: {list(missing)[:5]}")

        # 4. 句子结构检查（每段至少2句）
        for para in article["paragraphs"]:
            if len(para.get("sentences", [])) < 2:
                issues.append(f"段落 {para['id']} 句子数不足")
                break

        # 5. 中文翻译存在
        for para in article["paragraphs"]:
            for s in para["sentences"]:
                if not s.get("zh"):
                    issues.append("存在缺少中文翻译的句子")
                    break

        return CheckResult(passed=len(issues) == 0, issues=issues)

    def _count_words(self, article: dict) -> int:
        total = 0
        for para in article["paragraphs"]:
            for s in para["sentences"]:
                total += len(s["en"].split())
        return total
```

### 2.7 生成路由（routers/generate.py）

```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from app.models.request import GenerateCourseRequest, VerifyModelRequest
from app.services.generation.pipeline import GenerationPipeline
from app.services.ai_client import AIClient
from app.dependencies import get_current_user, get_supabase
from supabase import Client

router = APIRouter()

@router.post("/course", status_code=202)
async def start_course_generation(
    body: GenerateCourseRequest,
    background_tasks: BackgroundTasks,
    user = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    # 校验用户权限（自定义词库需要会员）
    if body.vocab_set_id != "builtin":
        profile = db.table("profiles").select("is_premium").eq("id", user.id).single().execute()
        if not profile.data.get("is_premium") and len(body.words) > 200:
            raise HTTPException(status_code=403, detail="超出免费版词汇数量限制，请升级会员")

    # 创建 AI 客户端（使用用户传入的配置）
    ai_client = AIClient(
        base_url=body.model_config.base_url,
        api_key=body.model_config.api_key,
        model=body.model_config.model_name,
        max_tokens=body.model_config.max_tokens,
        temperature=body.model_config.temperature,
    )

    # 将生成任务放入后台
    pipeline = GenerationPipeline(ai_client=ai_client, db=db)
    background_tasks.add_task(
        pipeline.run,
        vocab_set_id=body.vocab_set_id,
        words=body.words,
        user_id=user.id,
    )

    return {
        "message": "生成任务已启动",
        "vocab_set_id": body.vocab_set_id,
        "estimated_articles": max(len(body.words) // 100, 1),
    }


@router.post("/verify-model")
async def verify_model(
    body: VerifyModelRequest,
    user = Depends(get_current_user),
):
    """验证 AI 模型配置是否可用"""
    try:
        ai_client = AIClient(
            base_url=body.base_url,
            api_key=body.api_key,
            model=body.model_name,
            max_tokens=10,
            temperature=0.1,
        )
        # 发送最小测试请求
        result = await ai_client.chat(
            system="You are a helpful assistant.",
            user="Reply with the single word: OK"
        )
        return {"success": True, "message": "连接成功，模型可用"}
    except Exception as e:
        error_msg = str(e)
        if "401" in error_msg or "Unauthorized" in error_msg:
            detail = "API Key 无效或已过期"
        elif "404" in error_msg or "model" in error_msg.lower():
            detail = f"模型 {body.model_name} 不存在"
        elif "Connection" in error_msg or "timeout" in error_msg.lower():
            detail = "无法连接到服务器，请检查 Base URL"
        else:
            detail = error_msg
        return {"success": False, "message": detail}
```

### 2.8 请求模型（models/request.py）

```python
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional

class ModelConfigRequest(BaseModel):
    base_url: str = Field(..., description="OpenAI 兼容接口地址")
    api_key: str = Field(..., min_length=1)
    model_name: str = Field(..., min_length=1)
    max_tokens: int = Field(default=4096, ge=512, le=16384)
    temperature: float = Field(default=0.8, ge=0.0, le=2.0)

class GenerateCourseRequest(BaseModel):
    vocab_set_id: str
    words: list[str] = Field(..., min_length=10, max_length=10000)
    settings: dict = Field(default_factory=dict)
    model_config_: ModelConfigRequest = Field(alias="model_config")

    class Config:
        populate_by_name = True

class VerifyModelRequest(BaseModel):
    base_url: str
    api_key: str
    model_name: str

class VocabPreviewRequest(BaseModel):
    raw_text: str = Field(..., max_length=500_000)
```

---

## 3. 数据库详细设计

### 3.1 完整建表 SQL

```sql
-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- profiles
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_premium    BOOLEAN NOT NULL DEFAULT FALSE,
  premium_until TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles(id) VALUES(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- vocab_sets
CREATE TABLE public.vocab_sets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('builtin', 'custom')),
  builtin_id    TEXT,
  word_count    INTEGER,
  article_count INTEGER,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','generating','ready','failed')),
  gen_progress  INTEGER NOT NULL DEFAULT 0,
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- vocab_words
CREATE TABLE public.vocab_words (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_set_id  UUID NOT NULL REFERENCES public.vocab_sets(id) ON DELETE CASCADE,
  word          TEXT NOT NULL,
  freq_rank     SMALLINT NOT NULL DEFAULT 3 CHECK (freq_rank BETWEEN 1 AND 5),
  topic_tags    TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vocab_set_id, word)
);

-- courses
CREATE TABLE public.courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_set_id  UUID NOT NULL REFERENCES public.vocab_sets(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_articles INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vocab_set_id)
);

-- articles
CREATE TABLE public.articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  vocab_set_id  UUID NOT NULL REFERENCES public.vocab_sets(id),
  index         INTEGER NOT NULL,
  title         TEXT NOT NULL,
  topic         TEXT NOT NULL,
  topic_en      TEXT,
  content       JSONB NOT NULL,
  target_word_count INTEGER NOT NULL DEFAULT 0,
  is_free       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, index)
);

-- article_target_words
CREATE TABLE public.article_target_words (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  word          TEXT NOT NULL,
  sentence_id   TEXT NOT NULL,
  form_used     TEXT NOT NULL
);

-- dict_entries（全局词典，所有词库共享）
CREATE TABLE public.dict_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word          TEXT UNIQUE NOT NULL,
  phonetic      TEXT,
  pos           TEXT,
  definitions   JSONB NOT NULL DEFAULT '[]',
  etymology     TEXT,
  examples      JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- reading_progress
CREATE TABLE public.reading_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id    UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'unread'
                CHECK (status IN ('unread','reading','done')),
  progress_pct  SMALLINT NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  last_read_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

-- wordbook
CREATE TABLE public.wordbook (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word          TEXT NOT NULL,
  article_id    UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, word)
);

-- model_configs（不存明文 Key）
CREATE TABLE public.model_configs (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url      TEXT,
  model_name    TEXT,
  max_tokens    INTEGER DEFAULT 4096,
  temperature   FLOAT DEFAULT 0.8,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- 注意：API Key 不存数据库，只在客户端本地加密存储
);

-- 索引
CREATE INDEX idx_articles_course      ON public.articles(course_id, index);
CREATE INDEX idx_articles_vocab_set   ON public.articles(vocab_set_id);
CREATE INDEX idx_atw_article          ON public.article_target_words(article_id);
CREATE INDEX idx_atw_word             ON public.article_target_words(word);
CREATE INDEX idx_progress_user        ON public.reading_progress(user_id);
CREATE INDEX idx_progress_article     ON public.reading_progress(article_id);
CREATE INDEX idx_wordbook_user        ON public.wordbook(user_id);
CREATE INDEX idx_vocab_words_set      ON public.vocab_words(vocab_set_id);
CREATE INDEX idx_dict_word            ON public.dict_entries(word);
```

### 3.2 常用查询封装（lib/supabase/queries.ts）

```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()

// 获取课程文章列表（含用户进度）
export async function getCourseArticles(courseId: string, userId: string) {
  return supabase
    .from('articles')
    .select(`
      id, index, title, topic, target_word_count, is_free,
      progress:reading_progress(status, progress_pct)
    `)
    .eq('course_id', courseId)
    .order('index')
}

// 获取用户生词本（含词典数据）
export async function getWordbook(userId: string) {
  return supabase
    .from('wordbook')
    .select(`
      id, word, created_at,
      article:articles(title, topic),
      dict:dict_entries(phonetic, pos, definitions)
    `)
    .order('created_at', { ascending: false })
}

// 获取学习统计
export async function getLearningStats(userId: string) {
  const [progressResult, wordbookResult] = await Promise.all([
    supabase
      .from('reading_progress')
      .select('status', { count: 'exact' })
      .eq('status', 'done'),
    supabase
      .from('wordbook')
      .select('id', { count: 'exact' }),
  ])

  return {
    doneCount: progressResult.count ?? 0,
    wordbookCount: wordbookResult.count ?? 0,
  }
}
```

---

## 4. Prompt 详细设计

### 4.1 文章生成 Prompt（prompts/article_generation.txt）

```
You are a professional English story writer creating reading materials
for Chinese students preparing for the CET (College English Test).

STRICT RULES — follow all without exception:
1. Total English word count: 900–1100 words (count carefully)
2. Use EVERY word from the "Target words" list, each exactly ONCE
3. Words may appear in inflected forms (abandon→abandoned, run→running)
4. All non-target vocabulary must be simple (A2–B1 CEFR level)
5. Write a narrative story: real characters, clear plot, specific setting
6. Structure: 8–12 paragraphs, 3–6 sentences each
7. Story topic must match the given theme
8. Provide accurate Chinese translation for every sentence
9. Output ONLY valid JSON — no markdown, no explanation, no extra text

JSON OUTPUT STRUCTURE:
{
  "title": "Title of the Story",
  "paragraphs": [
    {
      "id": 1,
      "sentences": [
        {
          "id": "1-1",
          "en": "Complete English sentence.",
          "zh": "对应的中文翻译。",
          "target_words": ["word1"]
        }
      ]
    }
  ],
  "target_words_used": [
    {
      "word": "original_form",
      "form_used": "form_as_appeared",
      "sentence_id": "1-1"
    }
  ]
}

QUALITY CHECKLIST before outputting:
□ Did I use all target words?
□ Is total word count between 900–1100?
□ Is the story coherent and engaging?
□ Is every sentence translated to Chinese?
□ Is the JSON valid?
```

### 4.2 词典生成 Prompt（prompts/dict_generation.txt）

```
You are a professional English dictionary editor creating entries
for Chinese learners. Generate dictionary data for the given word.

OUTPUT ONLY valid JSON — no markdown, no explanation:
{
  "word": "original lowercase form",
  "phonetic": "IPA notation, American English, e.g. /əˈbændən/",
  "pos": "part of speech abbreviation: v. / n. / adj. / adv. / prep. / conj.",
  "definitions": [
    {
      "pos": "v.",
      "meaning": "简洁中文释义（不超过15字）",
      "en": "concise English definition"
    }
  ],
  "etymology": "简短词根说明，例：源自拉丁语 xxx，意为「...」（可留空字符串）",
  "examples": [
    {
      "en": "Natural example sentence using the word.",
      "zh": "自然的中文翻译。"
    },
    {
      "en": "Second example in a different context.",
      "zh": "第二个例句的中文翻译。"
    }
  ]
}

RULES:
- Include 1–3 definitions (most common meanings only)
- Examples must be natural, not textbook-stiff
- Chinese definitions must be accurate and concise
- Etymology: brief, useful for memory (ok to omit if unhelpful)
```

---

## 5. 类型定义

### 5.1 前端类型（types/article.ts）

```typescript
export interface Sentence {
  id: string          // "1-1"
  en: string
  zh: string
  target_words: string[]
}

export interface Paragraph {
  id: number
  sentences: Sentence[]
}

export interface ArticleContent {
  paragraphs: Paragraph[]
}

export interface Article {
  id: string
  title: string
  topic: string
  topic_en: string
  index: number
  is_free: boolean
  content: ArticleContent
  target_word_count: number
  course: { id: string; vocab_set_id: string }
  target_words: TargetWordPosition[]
}

export interface TargetWordPosition {
  word: string
  sentence_id: string
  form_used: string
}

export interface DictEntry {
  word: string
  phonetic: string
  pos: string
  definitions: Definition[]
  etymology: string
  examples: Example[]
}

export interface Definition {
  pos: string
  meaning: string
  en: string
}

export interface Example {
  en: string
  zh: string
}
```

---

## 6. 错误处理规范

### 6.1 前端错误边界

```tsx
// components/ErrorBoundary.tsx
'use client'
import { Component, ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center p-8 text-neutral-500">
          <p className="text-sm">出了点问题，请刷新重试</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 text-sm text-primary-700 underline"
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

### 6.2 后端统一错误响应

```python
# app/utils/errors.py
from fastapi import HTTPException
from fastapi.responses import JSONResponse

# 统一错误码定义
class ErrorCode:
    AI_CALL_FAILED     = "AI_CALL_FAILED"
    INVALID_API_KEY    = "INVALID_API_KEY"
    GENERATION_FAILED  = "GENERATION_FAILED"
    QUOTA_EXCEEDED     = "QUOTA_EXCEEDED"
    INVALID_VOCAB      = "INVALID_VOCAB"

def ai_error(detail: str, code: str = ErrorCode.AI_CALL_FAILED):
    raise HTTPException(status_code=502, detail={"code": code, "message": detail})

def auth_error(detail: str = "认证失败"):
    raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": detail})
```

### 6.3 生成重试机制

```python
# services/generation/pipeline.py（重试逻辑）
async def generate_with_retry(
    writer: ArticleWriter,
    checker: QualityChecker,
    plan: ArticlePlan,
    ai_client: AIClient,
    max_retries: int = 3,
) -> dict:
    last_issues = []
    for attempt in range(max_retries):
        try:
            article = await writer.write(plan, ai_client)
            result = checker.check(article, plan)
            if result.passed:
                return article
            last_issues = result.issues
            # 把问题反馈给下一次生成（让 AI 修正）
            plan = plan.with_hint(f"上次生成的问题：{'; '.join(last_issues)}")
        except Exception as e:
            last_issues = [str(e)]

    # 3次都失败，记录日志并标记该篇为失败
    logger.error(f"文章生成失败 index={plan.index}: {last_issues}")
    raise GenerationError(f"文章生成失败，问题：{last_issues}")
```

---

## 7. 本地开发启动指南

### 7.1 前提条件

```bash
# 需要安装
node >= 18.0.0
python >= 3.11
pnpm >= 8.0.0（或 npm）

# 需要账号
Supabase 账号（免费）
```

### 7.2 后端启动

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 Supabase URL 和 Service Key

# 启动（开发模式，支持热重载）
uvicorn app.main:app --reload --port 8000
```

### 7.3 前端启动

```bash
cd frontend

# 安装依赖
pnpm install

# 配置环境变量
cp .env.local.example .env.local
# 填入 Supabase URL、Anon Key、后端地址

# 启动
pnpm dev
# 访问 http://localhost:3000
```

### 7.4 数据库初始化

```bash
# 在 Supabase Dashboard 的 SQL Editor 中执行：
# 1. 粘贴并执行 phase4.5 文档中的完整建表 SQL
# 2. 执行 RLS 策略 SQL
# 3. 执行索引 SQL

# 导入内置词库（在后端执行）
cd backend
python scripts/import_builtin_vocabs.py
```

### 7.5 requirements.txt

```
fastapi==0.110.0
uvicorn[standard]==0.29.0
pydantic==2.6.0
pydantic-settings==2.2.0
openai==1.14.0
supabase==2.4.0
wordfreq==3.0.3
loguru==0.7.2
python-multipart==0.0.9
httpx==0.27.0
```

### 7.6 package.json（前端核心依赖）

```json
{
  "dependencies": {
    "next": "14.2.0",
    "react": "^18",
    "react-dom": "^18",
    "typescript": "^5",
    "@supabase/supabase-js": "^2",
    "@supabase/auth-helpers-nextjs": "^0.10",
    "@supabase/auth-helpers-react": "^0.5",
    "@tanstack/react-query": "^5",
    "zustand": "^4",
    "framer-motion": "^11",
    "react-dropzone": "^14",
    "react-hook-form": "^7",
    "zod": "^3",
    "lucide-react": "^0.383",
    "tailwind-merge": "^2",
    "clsx": "^2"
  }
}
```

---

*文档状态：✅ Phase 4.5 完成*
*下一步：Phase 5 · 商业模式 / Phase 6 · MVP 开发计划*
