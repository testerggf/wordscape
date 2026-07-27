# Supabase 持久化接入说明

## 1. 创建项目

1. 打开 Supabase 控制台。
2. 创建新项目。
3. 记录以下配置：
   - Project URL
   - anon public key
   - service role key

## 2. 初始化数据库

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
-- 粘贴并执行 docs/supabase-schema.sql 的全部内容
```

执行后应看到以下核心表：

- `profiles`
- `vocab_sets`
- `vocab_words`
- `courses`
- `articles`
- `article_target_words`
- `dict_entries`
- `reading_progress`
- `wordbook`
- `model_configs`

## 3. 配置前端环境变量

复制 `frontend/.env.local.example` 为 `frontend/.env.local`：

```bash
cd frontend
cp .env.local.example .env.local
```

填写：

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_BUILTIN_DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 anon key
```

## 4. 配置后端环境变量

复制 `backend/.env.example` 为 `backend/.env`：

```bash
cd backend
cp .env.example .env
```

填写：

```bash
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_KEY=你的 service role key
ENCRYPT_SECRET=替换成至少32位的随机字符串
```

## 5. 当前阶段说明

Phase 6 先完成数据库结构和封装层，不强制把现有页面全部切到 Supabase。

内置课程数据源可通过 `NEXT_PUBLIC_BUILTIN_DATA_SOURCE` 配置：

1. `local`：始终读取 `frontend/data/courses/*.json`。
2. `supabase`：优先读取 Supabase；连接失败、超时、空数据或结构异常时自动回退本地 JSON。

用户学习状态当前仍使用 `localStorage`，后续可逐页替换：

1. 阅读进度：`localStorage` → `reading_progress`
2. 生成课程保存：`localStorage` → 后端 service role 写库
3. 阅读进度：`localStorage` → `reading_progress`
4. 生词本：`localStorage` → `wordbook`

## 6. RLS 验证建议

至少用两个测试账号验证：

1. A 用户不能读取 B 用户的自定义词库。
2. 未登录用户只能读取 `is_free = true` 的文章。
3. 已登录但非会员用户不能读取内置课程第 6 篇及之后的付费文章。
4. 用户只能写自己的 `reading_progress`、`wordbook` 和 `model_configs`。
