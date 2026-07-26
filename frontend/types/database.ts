export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      vocab_sets: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          source: "builtin" | "custom";
          builtin_id: string | null;
          word_count: number;
          article_count: number;
          status: "pending" | "generating" | "ready" | "failed";
          gen_progress: number;
          settings: Json;
          created_at: string;
        };
      };
      courses: {
        Row: {
          id: string;
          vocab_set_id: string;
          user_id: string | null;
          title: string;
          total_articles: number;
          created_at: string;
        };
      };
      articles: {
        Row: {
          id: string;
          course_id: string;
          vocab_set_id: string;
          index: number;
          title: string;
          topic: string;
          topic_en: string | null;
          content: Json;
          target_word_count: number;
          word_count: number;
          is_free: boolean;
          quality: Json;
          created_at: string;
        };
      };
      dict_entries: {
        Row: {
          id: string;
          word: string;
          phonetic: string | null;
          pos: string | null;
          definitions: Json;
          etymology: string | null;
          examples: Json;
          created_at: string;
        };
      };
      reading_progress: {
        Row: {
          id: string;
          user_id: string;
          article_id: string;
          status: "unread" | "reading" | "done";
          progress_pct: number;
          last_read_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          article_id: string;
          status?: "unread" | "reading" | "done";
          progress_pct?: number;
          last_read_at?: string | null;
        };
        Update: {
          status?: "unread" | "reading" | "done";
          progress_pct?: number;
          last_read_at?: string | null;
        };
      };
      wordbook: {
        Row: {
          id: string;
          user_id: string;
          word: string;
          article_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          word: string;
          article_id?: string | null;
          created_at?: string;
        };
        Update: {
          word?: string;
          article_id?: string | null;
        };
      };
    };
  };
}
