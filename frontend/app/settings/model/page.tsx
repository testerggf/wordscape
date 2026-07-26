"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle, Save, WandSparkles } from "lucide-react";
import { useState } from "react";
import { apiPost, DEFAULT_MODEL_CONFIG, loadModelConfig, saveModelConfig, type ModelConfig } from "@/lib/api";

const PRESETS: Array<{ label: string; config: ModelConfig }> = [
  { label: "本地 Mock", config: DEFAULT_MODEL_CONFIG },
  {
    label: "OpenAI",
    config: {
      base_url: "https://api.openai.com/v1",
      api_key: "",
      model_name: "gpt-4o-mini",
      max_tokens: 4096,
      temperature: 0.8,
    },
  },
  {
    label: "DeepSeek",
    config: {
      base_url: "https://api.deepseek.com/v1",
      api_key: "",
      model_name: "deepseek-chat",
      max_tokens: 4096,
      temperature: 0.8,
    },
  },
  {
    label: "DashScope",
    config: {
      base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      api_key: "",
      model_name: "qwen-plus",
      max_tokens: 4096,
      temperature: 0.8,
    },
  },
];

export default function ModelSettingsPage() {
  const [config, setConfig] = useState<ModelConfig>(() => loadModelConfig());
  const [message, setMessage] = useState("当前默认使用本地 Mock，可直接跑通生成流程。");
  const [loading, setLoading] = useState(false);

  const update = (patch: Partial<ModelConfig>) => setConfig((current) => ({ ...current, ...patch }));

  const verify = async () => {
    setLoading(true);
    setMessage("正在验证模型连接...");
    try {
      const result = await apiPost<{ ok: boolean; message: string }, ModelConfig>("/api/generate/verify-model", config);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "验证失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--neutral-50)] px-5 py-5">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-5 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm text-[var(--neutral-700)] shadow-sm">
          <ArrowLeft size={17} />
          返回首页
        </Link>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--primary-700)]">
            <WandSparkles size={17} />
            AI 模型配置
          </div>
          <h1 className="text-3xl font-bold text-[var(--neutral-900)]">生成文章前先配置模型</h1>
          <p className="mt-2 text-sm leading-7 text-[var(--neutral-700)]">
            MVP 当前支持 OpenAI 兼容接口。默认 Mock 配置用于本地验证，不会发起外部模型请求。
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                className="rounded-full border border-[var(--neutral-200)] px-4 py-2 text-sm font-medium text-[var(--neutral-700)] hover:border-[var(--primary-700)]"
                onClick={() => setConfig(preset.config)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4">
            <Field label="Base URL" value={config.base_url} onChange={(value) => update({ base_url: value })} />
            <Field label="API Key" value={config.api_key} onChange={(value) => update({ api_key: value })} type="password" />
            <Field label="模型名称" value={config.model_name} onChange={(value) => update({ model_name: value })} />
          </div>

          <div className="mt-5 rounded-lg bg-[var(--neutral-100)] p-4 text-sm leading-6 text-[var(--neutral-700)]">{message}</div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--primary-800)] text-sm font-semibold text-[var(--primary-800)]"
              onClick={verify}
              disabled={loading}
            >
              <CheckCircle size={17} />
              {loading ? "验证中..." : "验证连接"}
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary-800)] text-sm font-semibold text-white"
              onClick={() => {
                saveModelConfig(config);
                setMessage("配置已保存。");
              }}
            >
              <Save size={17} />
              保存配置
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[var(--neutral-700)]">
      {label}
      <input
        className="h-11 rounded-lg border border-[var(--neutral-200)] bg-white px-3 text-[var(--neutral-900)] outline-none focus:border-[var(--primary-700)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        step={step}
      />
    </label>
  );
}
