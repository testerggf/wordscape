import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toArticle, toCourse } from "@/lib/supabase/adapters";

export async function fetchCourse(courseId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("courses")
    .select(`
      id,
      title,
      total_articles,
      articles (
        id,
        course_id,
        index,
        title,
        topic,
        content,
        target_word_count,
        word_count,
        is_free
      )
    `)
    .eq("id", courseId)
    .single();

  if (error || !data) return null;
  return toCourse(data);
}

export async function fetchArticle(articleId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("articles")
    .select("id, course_id, index, title, topic, content, target_word_count, word_count, is_free")
    .eq("id", articleId)
    .single();

  if (error || !data) return null;
  return toArticle(data);
}

export async function upsertReadingProgress(articleId: string, progressPct: number) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  await supabase.from("reading_progress").upsert({
    user_id: auth.user.id,
    article_id: articleId,
    status: progressPct >= 95 ? "done" : "reading",
    progress_pct: progressPct,
    last_read_at: new Date().toISOString(),
  }, { onConflict: "user_id,article_id" });
}

export async function toggleWordbookWord(word: string, articleId?: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const { data: existing } = await supabase
    .from("wordbook")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("word", word)
    .maybeSingle();

  if (existing) {
    await supabase.from("wordbook").delete().eq("id", existing.id);
    return;
  }

  await supabase.from("wordbook").insert({
    user_id: auth.user.id,
    word,
    article_id: articleId ?? null,
  });
}
