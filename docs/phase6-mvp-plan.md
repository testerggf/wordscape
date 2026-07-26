# Phase 6 · MVP 开发计划

> **项目名称**：词境（WordScape）
> **文档版本**：v1.0
> **阶段**：MVP 开发计划
> **目标**：最小可验证产品，能跑通「选词库 → 生成文章 → 阅读 → 查词」核心链路

---

## 目录

1. [MVP 范围界定](#1-mvp-范围界定)
2. [开发环境搭建](#2-开发环境搭建)
3. [任务拆解与优先级](#3-任务拆解与优先级)
4. [迭代计划（6周）](#4-迭代计划6周)
5. [开发顺序详解](#5-开发顺序详解)
6. [测试策略](#6-测试策略)
7. [上线 Checklist](#7-上线-checklist)
8. [上线后第一周观测指标](#8-上线后第一周观测指标)

---

## 1. MVP 范围界定

### 1.1 MVP 必须跑通的核心链路

```
用户打开网站
  → 选择内置词库（四级）
  → 进入文章列表
  → 点击第一篇（免费）
  → 阅读英文 + 中文对照
  → 点击句子 → TTS 朗读
  → 点击/双击单词 → 词典卡片弹出
  → 词典卡片：音标 + 释义 + 例句 + 发音
  → 加入生词本
  → 完成文章，显示完成卡片
  → 尝试第6篇 → 触发付费引导
```

```
用户配置 AI 模型
  → 填写 Base URL + API Key + 模型名
  → 验证连接
  → 粘贴自定义词汇
  → 预览课程结构
  → 生成课程（后台异步）
  → 实时看到生成进度
  → 生成完成 → 进入阅读
```

### 1.2 MVP 包含 / 不包含

| 功能 | MVP 包含 | 理由 |
|------|---------|------|
| 内置词库（四级）阅读 | ✅ | 核心体验，必须 |
| 中英文对照 | ✅ | 核心体验 |
| 目标词高亮 + 词典卡片 | ✅ | 核心体验 |
| TTS 朗读（Web Speech API） | ✅ | 核心体验 |
| 自定义词库导入 + AI 生成 | ✅ | 最大差异化功能 |
| 模型配置页 | ✅ | 自定义词库依赖 |
| 生成进度实时显示 | ✅ | 体验闭环必须 |
| 邮箱注册 / 登录 | ✅ | 进度保存依赖 |
| 阅读进度保存 | ✅ | 基础留存 |
| 生词本 | ✅ | 核心功能 |
| 付费墙（前5篇免费） | ✅ | 商业闭环 |
| 学习统计页 | ⚠️ 简版 | 只做数字，不做图表 |
| 六级/考研等内置词库 | ❌ | 先做四级验证 |
| 微信登录 | ❌ | 后续迭代 |
| 词汇自测 / 复习模式 | ❌ | 后续迭代 |
| 连续学习 Streak | ❌ | 后续迭代 |
| 深色模式 | ❌ | 后续迭代 |

### 1.3 MVP 内置数据要求

上线前必须准备好的数据：
- 四级词库 4000 词（txt 文件）
- 用官方 Key 预生成好 40 篇四级文章（存入数据库）
- 40 篇文章的词典数据（批量预生成）
- 前 5 篇标记为 `is_free = true`

---

## 2. 开发环境搭建

### 2.1 第一天必做清单

```bash
# 1. 创建 Monorepo
mkdir wordscape && cd wordscape
git init
echo "node_modules\n.env\n.env.local\n__pycache__\nvenv" > .gitignore

# 2. 前端脚手架
pnpm create next-app frontend --typescript --tailwind --app --no-src-dir
cd frontend
pnpm add @supabase/supabase-js @supabase/auth-helpers-nextjs \
         @supabase/auth-helpers-react @tanstack/react-query \
         zustand framer-motion react-dropzone \
         react-hook-form zod lucide-react \
         tailwind-merge clsx
pnpm add -D @types/node

# 3. 后端脚手架
cd ..
mkdir backend && cd backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn[standard] pydantic pydantic-settings \
            openai supabase wordfreq loguru python-multipart httpx

# 4. Supabase 项目
# 登录 supabase.com → New Project → 记录 URL 和 anon key

# 5. 环境变量
cat > frontend/.env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
EOF

cat > backend/.env << EOF
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx
ENCRYPT_SECRET=your-32-char-secret-here-padding
CORS_ORIGINS=["http://localhost:3000"]
DEBUG=true
EOF
```

### 2.2 Supabase 数据库初始化

```sql
-- 在 Supabase Dashboard → SQL Editor 中依次执行：

-- Step 1: 建表（粘贴 Phase 4.5 文档第3章完整建表 SQL）
-- Step 2: RLS 策略（粘贴 Phase 4 文档 RLS 部分）
-- Step 3: 索引（已包含在建表 SQL 中）
```

### 2.3 shadcn/ui 初始化

```bash
cd frontend
pnpm dlx shadcn-ui@latest init
# 选择：Default → Slate → CSS variables: Yes

# 按需添加组件
pnpm dlx shadcn-ui@latest add button input textarea
pnpm dlx shadcn-ui@latest add dialog sheet badge progress
pnpm dlx shadcn-ui@latest add skeleton tabs card
```

### 2.4 Tailwind CSS 扩展配置

```javascript
// frontend/tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#F0FAF2',
          100: '#D8F3DC',
          700: '#2D6A4F',
          800: '#1B4332',
          900: '#0D2B1F',
        },
        accent: {
          200: '#FDDCB5',
          400: '#F4A261',
          600: '#D4712A',
        },
        neutral: {
          50:  '#FAFAF8',
          100: '#F5F0E8',
          200: '#E8E2D9',
          400: '#9E9589',
          700: '#4A4540',
          900: '#1C1917',
        },
      },
      fontFamily: {
        lora:  ['var(--font-lora)', 'Georgia', 'serif'],
        noto:  ['var(--font-noto)', 'PingFang SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
```

---

## 3. 任务拆解与优先级

### P0 — 阻塞型（没有这个其他都跑不起来）

| ID | 任务 | 预估工时 |
|----|------|---------|
| P0-1 | Supabase 建表 + RLS + 索引 | 2h |
| P0-2 | 四级词库数据导入（4000词） | 1h |
| P0-3 | 后端 FastAPI 基础骨架（main/config/deps） | 2h |
| P0-4 | 前端 Next.js 基础骨架（路由/布局/Provider） | 3h |
| P0-5 | Supabase Auth 接入（注册/登录页） | 3h |
| P0-6 | 前端直连 Supabase 基础查询封装 | 1h |

### P1 — 核心链路（MVP 必须）

| ID | 任务 | 预估工时 | 依赖 |
|----|------|---------|------|
| P1-1 | 内置四级词库预生成文章（用官方Key跑脚本） | 4h | P0-1,2 |
| P1-2 | 词典数据批量生成脚本 | 2h | P1-1 |
| P1-3 | 文章列表页（课程中心） | 3h | P0-4,6 |
| P1-4 | 阅读器页面 — 文章渲染（英文+分词） | 4h | P1-3 |
| P1-5 | 阅读器页面 — 目标词高亮 | 2h | P1-4 |
| P1-6 | 阅读器页面 — 中文对照面板 | 2h | P1-4 |
| P1-7 | 阅读器页面 — 句子点击 TTS 朗读 | 2h | P1-4 |
| P1-8 | 词典卡片组件（弹层 + 内容展示） | 4h | P1-5 |
| P1-9 | 词典数据查询（Supabase 直连） | 1h | P1-8 |
| P1-10 | 阅读进度保存（滚动进度 + 状态） | 2h | P1-4 |
| P1-11 | 完成文章弹窗（打卡卡片） | 2h | P1-10 |
| P1-12 | 生词本（添加 + 列表页） | 3h | P1-8 |
| P1-13 | 付费墙（第6篇锁定 + 引导弹层） | 2h | P1-3 |

### P2 — 自定义词库（MVP 必须，可晚一周）

| ID | 任务 | 预估工时 | 依赖 |
|----|------|---------|------|
| P2-1 | 后端词汇清洗 + 词频标注（VocabProcessor） | 3h | P0-3 |
| P2-2 | 后端话题聚类（AI调用） | 2h | P2-1 |
| P2-3 | 后端课程规划器（CoursePlanner） | 3h | P2-2 |
| P2-4 | 后端文章生成器 + Prompt（ArticleWriter） | 4h | P2-3 |
| P2-5 | 后端质量校验器（QualityChecker） | 2h | P2-4 |
| P2-6 | 后端生成流水线串联（Pipeline） | 3h | P2-5 |
| P2-7 | 后端生成 API（/api/generate/course） | 2h | P2-6 |
| P2-8 | 后端模型验证 API（/api/generate/verify-model） | 1h | P0-3 |
| P2-9 | 后端词汇预览 API（/api/vocab/preview） | 2h | P2-1 |
| P2-10 | 前端模型配置页 | 3h | P0-4 |
| P2-11 | 前端词库导入组件（粘贴+文件上传） | 3h | P2-9 |
| P2-12 | 前端生成进度（Supabase Realtime订阅） | 2h | P2-7 |

### P3 — 体验完善（上线前补齐）

| ID | 任务 | 预估工时 |
|----|------|---------|
| P3-1 | Landing 首页 | 4h |
| P3-2 | 手机底部导航 + PC 侧边栏 | 2h |
| P3-3 | 学习统计页（简版：三个数字） | 2h |
| P3-4 | 词库中心页面 | 2h |
| P3-5 | 阅读器顶部进度条 | 1h |
| P3-6 | 文章列表话题筛选 | 1h |
| P3-7 | 响应式适配检查（手机/PC） | 2h |
| P3-8 | 空状态处理（无文章、无生词等） | 1h |
| P3-9 | Loading 骨架屏 | 2h |
| P3-10 | 错误提示 Toast 组件 | 1h |

**总工时预估**：
```
P0：  11h
P1：  31h
P2：  28h
P3：  18h
──────────
合计：约 88h（≈ 11个工作日，按每天8h）
```

---

## 4. 迭代计划（6周）

```
Week 1  搭骨架 + 跑通阅读核心
Week 2  完善阅读体验 + 词典 + 生词本
Week 3  自定义词库 + AI 生成后端
Week 4  前端接入生成流程 + 联调
Week 5  体验打磨 + 付费墙 + Landing 页
Week 6  测试 + 数据准备 + 上线
```

### Week 1 — 骨架 + 阅读核心

**目标**：能在本地看到文章、点词弹词典

```
Day 1  环境搭建（P0-1 ~ P0-6）
       ✓ Supabase 建表完毕
       ✓ 前后端项目跑起来
       ✓ 登录注册能用

Day 2  准备数据（P1-1, P1-2）
       ✓ 用脚本跑完 40 篇四级文章（需要 AI Key）
       ✓ 词典数据批量生成完毕
       ✓ 数据全部写入 Supabase

Day 3  文章列表页（P1-3, P3-4）
       ✓ 能看到 40 篇文章列表
       ✓ 文章卡片：标题、话题、状态

Day 4  阅读器基础（P1-4, P1-5, P1-6）
       ✓ 文章正文能渲染
       ✓ 目标词有高亮
       ✓ 中文对照能显示

Day 5  TTS + 词典（P1-7, P1-8, P1-9）
       ✓ 点句子能朗读
       ✓ 点目标词弹出词典卡片
       ✓ 词典卡片有音标、释义、例句

周末   自测 + 修 Bug
```

**Week 1 验收标准**：
- [ ] 能注册登录
- [ ] 能看到文章列表
- [ ] 能打开第一篇文章
- [ ] 目标词有黄色高亮
- [ ] 点击句子有 TTS 朗读
- [ ] 双击词语弹出词典卡片

---

### Week 2 — 阅读体验完善

**目标**：阅读流程完整闭环

```
Day 6  进度 + 完成（P1-10, P1-11）
       ✓ 滚动进度实时保存
       ✓ 读完弹完成卡片

Day 7  生词本（P1-12）
       ✓ 词典卡片内可加入生词本
       ✓ 生词本列表页能看到收藏词

Day 8  付费墙（P1-13）
       ✓ 第6篇点击显示付费引导
       ✓ 付费引导弹层样式完整

Day 9  UI 打磨（P3-2, P3-5, P3-6）
       ✓ 底部导航 / 侧边栏
       ✓ 顶部进度条
       ✓ 话题筛选标签

Day 10 体验细节（P3-8, P3-9, P3-10）
       ✓ 骨架屏加载状态
       ✓ 空状态处理
       ✓ Toast 错误提示

周末   手机端真机测试 + 修 Bug
```

**Week 2 验收标准**：
- [ ] 读完文章有打卡弹窗
- [ ] 生词本功能完整
- [ ] 付费引导弹层正常
- [ ] 手机端布局无错乱
- [ ] Loading 状态有骨架屏

---

### Week 3 — 自定义词库后端

**目标**：后端生成流水线跑通

```
Day 11  VocabProcessor（P2-1）
        ✓ 词汇清洗逻辑
        ✓ wordfreq 词频标注
        ✓ 单元测试通过

Day 12  CoursePlanner（P2-3）+ 话题聚类（P2-2）
        ✓ AI 话题聚类调用
        ✓ 课程结构规划逻辑
        ✓ 复现词分配逻辑

Day 13  ArticleWriter + Prompt（P2-4）
        ✓ 文章生成 Prompt 调优
        ✓ 生成结果 JSON 解析
        ✓ 测试：用 20 个词生成 1 篇文章

Day 14  QualityChecker + Pipeline（P2-5, P2-6）
        ✓ 质量校验逻辑
        ✓ 重试机制
        ✓ 流水线串联：输入词汇 → 输出完整课程数据

Day 15  API 接口（P2-7, P2-8, P2-9）
        ✓ /api/generate/course 接口
        ✓ /api/generate/verify-model 接口
        ✓ /api/vocab/preview 接口
        ✓ 用 curl / httpie 测试全部接口

周末    用真实词库跑一次完整生成 + 检查生成质量
```

**Week 3 验收标准**：
- [ ] 输入 100 个词，能完整生成 1 篇文章
- [ ] 质量校验能正确识别不合格文章
- [ ] 三个 API 接口 curl 测试全部通过
- [ ] 生成的文章中文翻译准确

---

### Week 4 — 前后端联调

**目标**：自定义词库完整流程可用

```
Day 16  模型配置页（P2-10）
        ✓ 预设服务商一键填写
        ✓ 验证连接功能
        ✓ 配置持久化到 localStorage

Day 17  词库导入组件（P2-11）
        ✓ 粘贴文本导入
        ✓ 文件上传（.txt/.csv）
        ✓ 调 /api/vocab/preview，展示预览

Day 18  生成进度（P2-12）
        ✓ 点击生成后跳转到进度页
        ✓ Supabase Realtime 订阅
        ✓ 进度条实时更新
        ✓ 生成完成自动跳转课程

Day 19  联调修 Bug
        ✓ 前后端数据格式对齐
        ✓ 错误情况处理（Key 无效/生成失败）
        ✓ CORS 配置检查

Day 20  端到端测试
        ✓ 从输入词库到读完第一篇，完整走一遍
        ✓ 手机端走一遍

周末    邀请 2-3 个朋友内测，收集反馈
```

**Week 4 验收标准**：
- [ ] 能配置 DeepSeek / DashScope 模型
- [ ] 粘贴词汇后能看到预览
- [ ] 点击生成能看到实时进度
- [ ] 生成完成后能直接进入阅读
- [ ] 生成失败有明确错误提示

---

### Week 5 — 打磨 + Landing 页

**目标**：产品有对外展示的门面，付费闭环完整

```
Day 21  Landing 首页（P3-1）
        ✓ Hero 区域
        ✓ 方法论展示（三步走）
        ✓ 内置词库展示卡片
        ✓ CTA 按钮

Day 22  Landing 首页续
        ✓ 阅读器预览截图/动效
        ✓ 定价区
        ✓ 移动端适配

Day 23  学习统计页（P3-3）
        ✓ 已读篇数、生词本数量
        ✓ 各课程进度

Day 24  付费接入
        ✓ 接入支付（推荐：Stripe 或 LemonSqueezy）
        ✓ 付款成功回调 → 更新 is_premium
        ✓ 测试支付流程

Day 25  全流程回归测试
        ✓ 注册 → 选词库 → 阅读 → 查词 → 生词本
        ✓ 配置模型 → 导入词汇 → 生成 → 阅读
        ✓ 付费 → 解锁全部

周末    响应式最终检查 + SEO meta 标签
```

**Week 5 验收标准**：
- [ ] Landing 页在手机上看起来专业
- [ ] 付费流程能走通（测试环境）
- [ ] 付费后 is_premium 正确更新
- [ ] 全流程无明显 Bug

---

### Week 6 — 上线准备

**目标**：部署完毕，正式上线

```
Day 26  部署前端（Vercel）
        ✓ 连接 GitHub 仓库
        ✓ 配置环境变量
        ✓ 自定义域名（如有）
        ✓ 检查生产环境构建

Day 27  部署后端（Railway）
        ✓ Dockerfile 验证
        ✓ 配置环境变量
        ✓ 配置生产 CORS
        ✓ 健康检查接口 /api/health

Day 28  数据库生产环境检查
        ✓ Supabase 生产项目 RLS 验证
        ✓ 确认四级文章数据完整（40篇）
        ✓ 词典数据完整性抽查

Day 29  上线前压测 + 安全检查
        ✓ API Key 不出现在任何日志
        ✓ 检查所有 console.log 已清理
        ✓ RLS 验证：用 A 账号不能访问 B 账号数据

Day 30  正式上线
        ✓ 执行上线 Checklist（见第7章）
        ✓ 发布第一条内容（小红书/B站）
        ✓ 盯紧 Supabase 日志和 Railway 日志

周末    收集第一批用户反馈
```

---

## 5. 开发顺序详解

### 5.1 数据优先原则

**先把 40 篇四级文章生成好，再写前端。**

原因：前端开发需要真实数据才能验证渲染效果，用假数据开发会返工。

```bash
# backend/scripts/generate_builtin_course.py
# 这个脚本在 Week 1 Day 2 运行，需要 ~30分钟

python scripts/generate_builtin_course.py \
  --vocab data/builtin_vocabs/cet4.txt \
  --model gpt-4o-mini \
  --api-key sk-xxx \
  --output-to-supabase
```

### 5.2 阅读器开发顺序

阅读器内部建议按以下顺序开发，每步都能立即看到效果：

```
Step 1  静态渲染：把 JSON 数据渲染成段落文字（不管样式）
Step 2  加样式：字体、行高、段落间距
Step 3  分词：把句子拆成 WordToken
Step 4  目标词高亮：给 target_word 加黄色底色
Step 5  点词交互：点击 → console.log(word)（先验证事件）
Step 6  词典数据查询：接入 Supabase，拿到词典数据
Step 7  词典卡片 UI：把数据渲染到弹层里
Step 8  中文对照：同步高亮逻辑
Step 9  TTS：接入 Web Speech API
Step 10 进度保存：滚动事件 + 防抖写库
```

### 5.3 后端生成流水线开发顺序

```
Step 1  先单独测试 AI Client：能成功调通 API 返回文本
Step 2  写死 20 个词，手动构造 Prompt，验证文章生成质量
Step 3  Prompt 调优（重点！）：反复测试直到生成质量稳定
Step 4  加 QualityChecker：验证词数/覆盖率检查逻辑
Step 5  VocabProcessor：词汇清洗 + 词频标注
Step 6  CoursePlanner：课程结构规划（可先 mock AI 聚类）
Step 7  串联 Pipeline：输入词汇 → 输出一篇文章
Step 8  加重试机制
Step 9  加进度更新（写 Supabase gen_progress 字段）
Step 10 串联生成 40 篇的完整流程
```

### 5.4 Prompt 调优是关键步骤

Prompt 质量直接决定生成文章的质量，建议：

```
调优方法：
1. 准备 10 个测试词汇组（不同话题各一组）
2. 每次修改 Prompt 后，对 10 组词汇全部测试
3. 记录每次结果的问题（词数不对/词没用上/翻译不准）
4. 评估指标：
   - 目标词覆盖率（目标 > 95%）
   - 词数准确率（目标 900-1100）
   - 文章可读性（主观打分 1-5）
   - 中文翻译准确性（主观打分 1-5）

常见问题与修复：
  问题：目标词没全用上
  修复：在 Prompt 加强「使用 EVERY word」的强调

  问题：生成 JSON 格式错误
  修复：在 Prompt 末尾加 quality checklist，让模型自检

  问题：文章故事性差（像词汇表堆砌）
  修复：要求「has characters, conflict, resolution」

  问题：中文翻译生硬
  修复：要求「natural Chinese, not word-for-word translation」
```

---

## 6. 测试策略

### 6.1 后端单元测试

```python
# tests/test_vocab_processor.py
import pytest
from app.services.generation.vocab_processor import VocabProcessor

def test_deduplication():
    processor = VocabProcessor()
    result = processor.process(["apple", "Apple", "APPLE", "banana"])
    words = [r["word"] for r in result]
    assert words.count("apple") == 1

def test_invalid_words_filtered():
    processor = VocabProcessor()
    result = processor.process(["hello", "123", "你好", "", "  "])
    assert len(result) == 1
    assert result[0]["word"] == "hello"

def test_freq_rank_assigned():
    processor = VocabProcessor()
    result = processor.process(["the", "abandon"])
    # "the" 是极高频词，rank 应该是 5
    the_word = next(r for r in result if r["word"] == "the")
    assert the_word["freq_rank"] == 5


# tests/test_quality_checker.py
from app.services.generation.quality_checker import QualityChecker
from app.services.generation.course_planner import ArticlePlan

def test_check_passes_valid_article():
    checker = QualityChecker()
    plan = ArticlePlan(
        index=1, topic="test", topic_en="test",
        target_words=["abandon", "absolute"],
        review_words=[]
    )
    # 构造一个合格的文章（简化）
    article = make_valid_article(target_words=["abandon", "absolute"])
    result = checker.check(article, plan)
    assert result.passed

def test_check_fails_low_coverage():
    checker = QualityChecker()
    plan = ArticlePlan(
        index=1, topic="test", topic_en="test",
        target_words=["abandon", "absolute", "academic"],
        review_words=[]
    )
    # 只用了2个目标词，缺少 academic
    article = make_valid_article(target_words=["abandon", "absolute"])
    result = checker.check(article, plan)
    assert not result.passed
    assert any("覆盖率" in issue for issue in result.issues)
```

### 6.2 前端关键组件测试

```typescript
// 不上 Jest，用手动测试清单代替（MVP 阶段节省时间）

// 阅读器手动测试清单：
// □ 目标词全部高亮
// □ 点击目标词弹出词典
// □ 点击非目标词双击弹出词典
// □ 词典卡片内容完整（音标/释义/例句）
// □ 点击 🔊 能播放发音
// □ 加入生词本按钮状态变化
// □ 点击句子高亮该句
// □ 点击句子 TTS 朗读
// □ 再次点击同句停止朗读
// □ 中文对照对应句子同步高亮
// □ 滚动到底部完成度到 95%+
// □ 刷新页面进度保留
```

### 6.3 端到端关键路径测试

```
测试路径 A：内置词库阅读
  1. 注册新账号
  2. 选择四级词库
  3. 打开第1篇
  4. 点击3个目标词查词典
  5. 加入2个生词本
  6. 滚动到底部
  7. 完成弹窗出现
  8. 点击下一篇
  9. 点击第6篇 → 付费弹窗出现
  10. 检查生词本有2个词

测试路径 B：自定义词库生成
  1. 进入设置，配置 DeepSeek 模型
  2. 验证连接成功
  3. 新建词库，粘贴 50 个词
  4. 预览：显示预计5篇
  5. 点击生成
  6. 看到进度条从 0% 开始增长
  7. 等待生成完成（约2分钟）
  8. 自动跳转到课程
  9. 打开第1篇，确认目标词高亮

测试路径 C：多设备进度同步
  1. 在 PC 读到第1篇 60%
  2. 换手机登录
  3. 打开第1篇，应提示「继续上次阅读」
```

---

## 7. 上线 Checklist

### 7.1 代码质量

```
□ 所有 console.log 已移除或改为 logger
□ 没有硬编码的 API Key 或密钥
□ .env 文件不在 git 仓库中（.gitignore 已配置）
□ TypeScript 无编译错误（pnpm build 通过）
□ Python 无语法错误（python -m py_compile 检查）
□ 敏感信息（用户 Key）不出现在任何日志
```

### 7.2 数据库

```
□ 生产 Supabase 项目已创建（区别于开发项目）
□ 所有表 RLS 已启用
□ 用两个不同账号验证 RLS 隔离有效
□ 40 篇四级文章已导入（count 验证）
□ 词典数据已导入（抽查10个词）
□ 前5篇 is_free = true 已确认
□ Supabase 数据库自动备份已开启
```

### 7.3 前端

```
□ Vercel 部署成功，build 无报错
□ 自定义域名已配置（如有）
□ HTTPS 已启用
□ 生产环境变量已配置（不是本地的 .env.local）
□ 手机端（iOS Safari / Android Chrome）测试通过
□ 微信内置浏览器基础功能可用（TTS 不可用有降级提示）
□ 首页 meta 标签完整（title/description/og:image）
□ favicon 已配置
□ 404 页面存在
```

### 7.4 后端

```
□ Railway 部署成功，服务健康
□ /api/health 接口返回 200
□ 生产 CORS 只允许正式域名（不含 localhost）
□ 生产环境 DEBUG=false
□ API 文档（/docs）在生产环境已关闭
□ Railway 日志可以正常查看
□ 内存使用正常（wordfreq 数据约占 50MB）
```

### 7.5 安全

```
□ Supabase Service Key 只在后端使用，未暴露给前端
□ 前端只用 Supabase Anon Key
□ 用户 API Key 不写入数据库
□ 验证：普通用户无法读取其他用户的文章进度
□ 验证：未付费用户无法直接访问第6篇文章的 API
□ Rate limiting（后续补，MVP 暂时跳过）
```

### 7.6 支付（如已接入）

```
□ Stripe/LemonSqueezy Webhook 已配置
□ 测试支付流程（用测试 Key）
□ 支付成功后 is_premium 正确更新
□ 支付失败不影响用户正常使用免费功能
```

### 7.7 上线后 10 分钟观察

```
□ 自己注册一个新账号走一遍完整流程
□ Railway 日志无 500 错误
□ Supabase 日志无异常
□ 第一篇文章能正常加载
□ 词典卡片能正常弹出
□ TTS 朗读正常
```

---

## 8. 上线后第一周观测指标

### 核心漏斗

```
访问首页
  ↓  目标：30% 转化
注册账号
  ↓  目标：80% 进入阅读
打开第1篇
  ↓  目标：60% 完成
读完第1篇
  ↓  目标：40% 继续
读到第5篇
  ↓  目标：15% 付费
付费解锁
```

### 每日关注数据

| 指标 | 查看方式 | 预警阈值 |
|------|---------|---------|
| 注册人数 | Supabase Auth Dashboard | — |
| 日活用户 | Supabase reading_progress 表 | — |
| 词典卡片调用次数/人 | Supabase wordbook 表 | < 5 次 → 高亮有问题 |
| 文章完成率 | reading_progress status=done | < 30% → 体验问题 |
| 生成失败率 | Railway 日志 ERROR 数 | > 5% → Prompt 或 API 问题 |
| 付费转化 | profiles is_premium=true | — |

### 第一周要收集的用户反馈

```
发给内测用户的 5 个问题：
1. 文章难度对你来说怎么样？（太难/合适/太简单）
2. 词典卡片的信息够用吗？缺什么？
3. 你会用自定义导入词汇的功能吗？
4. 最影响你继续使用的障碍是什么？
5. 你愿意为这个产品付多少钱？
```

---

## 附录：快速参考

### 常用命令

```bash
# 前端
pnpm dev          # 启动开发服务器
pnpm build        # 构建生产版本
pnpm lint         # Lint 检查

# 后端
uvicorn app.main:app --reload --port 8000   # 启动后端
pytest tests/ -v                             # 运行测试
python scripts/generate_builtin_course.py   # 生成内置词库文章

# 数据库
# Supabase Dashboard → Table Editor 查看数据
# SQL Editor 执行临时查询
```

### 关键文件速查

| 文件 | 用途 |
|------|------|
| `frontend/app/(app)/read/[articleId]/page.tsx` | 阅读器页面入口 |
| `frontend/components/reader/DictCard.tsx` | 词典卡片 |
| `frontend/stores/settingsStore.ts` | 模型配置持久化 |
| `frontend/hooks/useGeneration.ts` | 生成进度订阅 |
| `backend/app/services/generation/pipeline.py` | 生成总流程 |
| `backend/prompts/article_generation.txt` | 文章生成 Prompt |
| `backend/app/routers/generate.py` | 生成 API 路由 |

---

*文档状态：✅ Phase 6 完成*
*全部设计文档已产出，可以开始开发*
