export type TranslationMode = "click" | "always" | "hidden";

export interface ReaderSettings {
  /** 中文对照显示方式：点句显示（默认）/ 全文对照 / 隐藏 */
  translationMode: TranslationMode;
  /** TTS 朗读语速 */
  ttsRate: number;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  translationMode: "click",
  ttsRate: 0.85,
};

export const TTS_RATES = [0.75, 0.85, 1.0];

const KEY = "wordscape:reader-settings";

export function loadReaderSettings(): ReaderSettings {
  if (typeof window === "undefined") return DEFAULT_READER_SETTINGS;

  try {
    const saved = localStorage.getItem(KEY);
    return saved ? { ...DEFAULT_READER_SETTINGS, ...(JSON.parse(saved) as Partial<ReaderSettings>) } : DEFAULT_READER_SETTINGS;
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
}

export function saveReaderSettings(patch: Partial<ReaderSettings>) {
  const next = { ...loadReaderSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("wordscape:reader-settings-changed"));
}
