-- 词境 WordScape · Supabase 初始化脚本
-- 用法：在 Supabase Dashboard -> SQL Editor 中执行本文件。

create extension if not exists "pgcrypto";

-- 用户扩展资料。auth.users 由 Supabase Auth 管理。
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_premium boolean not null default false,
  premium_until timestamptz,
  created_at timestamptz not null default now()
);

-- 词库：内置词库 user_id 为空；自定义词库归属于用户。
create table if not exists public.vocab_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  source text not null check (source in ('builtin', 'custom')),
  builtin_id text,
  word_count integer not null default 0,
  article_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  gen_progress integer not null default 0,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.vocab_words (
  id uuid primary key default gen_random_uuid(),
  vocab_set_id uuid not null references public.vocab_sets(id) on delete cascade,
  word text not null,
  frequency_rank integer,
  topic_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (vocab_set_id, word)
);

-- 一个词库默认对应一个课程。
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  vocab_set_id uuid not null references public.vocab_sets(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  total_articles integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  vocab_set_id uuid not null references public.vocab_sets(id) on delete cascade,
  index integer not null,
  title text not null,
  topic text not null,
  topic_en text,
  content jsonb not null,
  target_word_count integer not null default 0,
  word_count integer not null default 0,
  is_free boolean not null default false,
  quality jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (course_id, index)
);

create table if not exists public.article_target_words (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  word text not null,
  sentence_id text not null,
  form_used text not null
);

-- 公共词典，跨词库共享。
create table if not exists public.dict_entries (
  id uuid primary key default gen_random_uuid(),
  word text unique not null,
  phonetic text,
  pos text,
  definitions jsonb not null default '[]',
  etymology text,
  examples jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  status text not null default 'unread' check (status in ('unread', 'reading', 'done')),
  progress_pct integer not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  last_read_at timestamptz,
  unique (user_id, article_id)
);

create table if not exists public.wordbook (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  article_id uuid references public.articles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, word)
);

-- 用户模型配置。API Key 只存后端加密后的密文。
create table if not exists public.model_configs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_url text,
  api_key_enc text,
  model_name text,
  max_tokens integer not null default 4096,
  temperature double precision not null default 0.8,
  updated_at timestamptz not null default now()
);

create index if not exists idx_vocab_sets_user_id on public.vocab_sets(user_id);
create index if not exists idx_vocab_sets_builtin_id on public.vocab_sets(builtin_id);
create index if not exists idx_vocab_words_set_id on public.vocab_words(vocab_set_id);
create index if not exists idx_courses_vocab_set_id on public.courses(vocab_set_id);
create index if not exists idx_courses_user_id on public.courses(user_id);
create index if not exists idx_articles_course_id on public.articles(course_id);
create index if not exists idx_articles_vocab_set_id on public.articles(vocab_set_id);
create index if not exists idx_article_target_words_article_id on public.article_target_words(article_id);
create index if not exists idx_reading_progress_user_id on public.reading_progress(user_id);
create index if not exists idx_wordbook_user_id on public.wordbook(user_id);

alter table public.profiles enable row level security;
alter table public.vocab_sets enable row level security;
alter table public.vocab_words enable row level security;
alter table public.courses enable row level security;
alter table public.articles enable row level security;
alter table public.article_target_words enable row level security;
alter table public.dict_entries enable row level security;
alter table public.reading_progress enable row level security;
alter table public.wordbook enable row level security;
alter table public.model_configs enable row level security;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

drop policy if exists vocab_sets_read_builtin_or_own on public.vocab_sets;
create policy vocab_sets_read_builtin_or_own on public.vocab_sets
  for select using (source = 'builtin' or user_id = auth.uid());

drop policy if exists vocab_sets_insert_own on public.vocab_sets;
create policy vocab_sets_insert_own on public.vocab_sets
  for insert with check (source = 'custom' and user_id = auth.uid());

drop policy if exists vocab_sets_update_own on public.vocab_sets;
create policy vocab_sets_update_own on public.vocab_sets
  for update using (user_id = auth.uid());

drop policy if exists vocab_words_read_visible_sets on public.vocab_words;
create policy vocab_words_read_visible_sets on public.vocab_words
  for select using (
    exists (
      select 1 from public.vocab_sets vs
      where vs.id = vocab_words.vocab_set_id
        and (vs.source = 'builtin' or vs.user_id = auth.uid())
    )
  );

drop policy if exists courses_read_builtin_or_own on public.courses;
create policy courses_read_builtin_or_own on public.courses
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.vocab_sets vs
      where vs.id = courses.vocab_set_id and vs.source = 'builtin'
    )
  );

drop policy if exists articles_read_free_or_member_or_own on public.articles;
create policy articles_read_free_or_member_or_own on public.articles
  for select using (
    is_free = true
    or exists (
      select 1 from public.courses c
      where c.id = articles.course_id and c.user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_premium = true
        and (p.premium_until is null or p.premium_until > now())
    )
  );

drop policy if exists article_target_words_read_visible_articles on public.article_target_words;
create policy article_target_words_read_visible_articles on public.article_target_words
  for select using (
    exists (
      select 1 from public.articles a
      where a.id = article_target_words.article_id
    )
  );

drop policy if exists dict_entries_public_read on public.dict_entries;
create policy dict_entries_public_read on public.dict_entries
  for select using (true);

drop policy if exists reading_progress_own_all on public.reading_progress;
create policy reading_progress_own_all on public.reading_progress
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists wordbook_own_all on public.wordbook;
create policy wordbook_own_all on public.wordbook
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists model_configs_own_all on public.model_configs;
create policy model_configs_own_all on public.model_configs
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
