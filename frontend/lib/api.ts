const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function parseOrThrow<TResponse>(response: Response): Promise<TResponse> {
  if (!response.ok) {
    const text = await response.text();
    let detail = text;
    try {
      detail = (JSON.parse(text) as { detail?: string }).detail ?? text;
    } catch {
      // 非 JSON 错误体，用原文
    }
    throw new Error(detail || `请求失败：${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function apiPost<TResponse, TBody = unknown>(path: string, body: TBody): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return parseOrThrow<TResponse>(response);
}

export async function apiGet<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  return parseOrThrow<TResponse>(response);
}

export interface ModelConfig {
  base_url: string;
  api_key: string;
  model_name: string;
  max_tokens: number;
  temperature: number;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  base_url: "http://mock.local/v1",
  api_key: "mock-local",
  model_name: "mock",
  max_tokens: 1024,
  temperature: 0.2,
};

export function loadModelConfig(): ModelConfig {
  if (typeof window === "undefined") return DEFAULT_MODEL_CONFIG;
  const saved = localStorage.getItem("wordscape:model-config");
  if (!saved) return DEFAULT_MODEL_CONFIG;

  try {
    return { ...DEFAULT_MODEL_CONFIG, ...JSON.parse(saved) };
  } catch {
    return DEFAULT_MODEL_CONFIG;
  }
}

export function saveModelConfig(config: ModelConfig) {
  localStorage.setItem("wordscape:model-config", JSON.stringify(config));
}

export interface VocabPreviewResponse {
  total_input_items: number;
  valid_words: string[];
  invalid_items: string[];
  duplicate_count: number;
  estimated_articles: number;
  topic_preview: Array<{ topic: string; count: number }>;
}

export interface GeneratedCourseResponse {
  course_title: string;
  total_words: number;
  total_articles: number;
  articles: Array<{
    index: number;
    title: string;
    title_zh?: string;
    topic: string;
    topic_en: string;
    paragraphs: Array<{
      id: number;
      sentences: Array<{
        id: string;
        en: string;
        zh: string;
        target_words: string[];
      }>;
    }>;
    target_words_used: Array<Record<string, string>>;
    target_word_count: number;
    word_count: number;
    quality: {
      passed: boolean;
      issues: string[];
      coverage: number;
    };
  }>;
}

export interface PersistGeneratedCourseResponse {
  vocab_set_id: string;
  course_id: string;
}

export type GeneratedArticle = GeneratedCourseResponse["articles"][number];

export interface ArticlePlanStatus {
  index: number;
  topic: string;
  target_word_count: number;
  status: "pending" | "generating" | "done" | "failed";
  title: string | null;
  error: string | null;
}

export interface PreviewArticleResponse {
  preview_id: string;
  course_title: string;
  total_words: number;
  total_articles: number;
  plans: ArticlePlanStatus[];
  first_article: GeneratedArticle;
}

export interface StartCourseResponse {
  task_id: string;
  total_articles: number;
}

export interface TaskStatusResponse {
  task_id: string;
  status: "pending" | "running" | "done" | "failed";
  course_title: string;
  total_articles: number;
  completed_articles: number;
  failed_articles: number;
  current_index: number | null;
  articles: ArticlePlanStatus[];
  error: string | null;
  result: GeneratedCourseResponse | null;
}
