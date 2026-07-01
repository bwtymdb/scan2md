export type Provider =
  | "claude"
  | "gemini"
  | "openai"
  | "qwen"
  | "glm"
  | "doubao"
  | "moonshot"
  | "ernie"
  | "hunyuan"
  | "custom";

export type ProviderKind = "anthropic" | "gemini" | "openai-compat";

export interface ProviderPreset {
  /** 设置下拉里显示的名字（只写厂商，不含具体模型版本号——版本会更新，模型从列表选取）。 */
  label: string;
  kind: ProviderKind;
  /** openai-compat：完整 chat/completions URL；anthropic/gemini：根域名。 */
  endpoint: string;
  /** 兜底默认模型：仅在未拉取到模型列表时使用。日常应点「获取模型列表」选取最新模型。 */
  defaultModel: string;
  /** 在设置里给用户的说明（key 来源、注意事项等）。 */
  note: string;
}

/**
 * 各服务商预设。国产厂商绝大多数都提供 OpenAI 兼容接口，统一走 openai-compat 通道。
 * 厂商名只写厂商、不带具体模型版本号；具体模型用设置里「模型名」右侧的刷新按钮
 * 拉取该 API 支持的列表后选取。defaultModel 仅作未拉取时的兜底。
 */
export const PROVIDER_PRESETS: Record<Provider, ProviderPreset> = {
  claude: {
    label: "Claude（Anthropic）",
    kind: "anthropic",
    endpoint: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-4-6",
    note: "Anthropic API Key（sk-ant-…）。",
  },
  gemini: {
    label: "Gemini（Google）",
    kind: "gemini",
    endpoint: "https://generativelanguage.googleapis.com",
    defaultModel: "gemini-1.5-pro",
    note: "Google AI Studio API Key（AIza…）。",
  },
  openai: {
    label: "OpenAI",
    kind: "openai-compat",
    endpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o",
    note: "OpenAI API Key（sk-…）。",
  },
  qwen: {
    label: "通义千问（阿里）",
    kind: "openai-compat",
    endpoint:
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen-vl-max-latest",
    note: "阿里云百炼 DashScope 的 API Key。",
  },
  glm: {
    label: "智谱 GLM",
    kind: "openai-compat",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "glm-4v-plus",
    note: "智谱开放平台 API Key。",
  },
  doubao: {
    label: "豆包（字节火山方舟）",
    kind: "openai-compat",
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    defaultModel: "doubao-1.5-vision-pro-32k",
    note:
      "火山方舟 API Key。豆包需在方舟控制台为视觉模型创建「推理接入点」，拉取到的列表即接入点 ID（ep-…），模型名也可直接填接入点 ID。",
  },
  moonshot: {
    label: "Kimi（月之暗面）",
    kind: "openai-compat",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "moonshot-v1-8k-vision-preview",
    note: "Moonshot API Key。",
  },
  ernie: {
    label: "文心（百度）",
    kind: "openai-compat",
    endpoint: "https://qianfan.baidubce.com/v2/chat/completions",
    defaultModel: "ernie-4.5-vl-preview",
    note: "百度千帆 API Key（走 OpenAI 兼容 v2 接口）。",
  },
  hunyuan: {
    label: "混元（腾讯）",
    kind: "openai-compat",
    endpoint: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
    defaultModel: "hunyuan-vision",
    note: "腾讯云混元 API Key。",
  },
  custom: {
    label: "自定义 OpenAI 兼容端点",
    kind: "openai-compat",
    endpoint: "",
    defaultModel: "",
    note:
      "在下方「API 端点」填完整 chat/completions 地址，可接 MiniMax / DeepSeek / Ollama(http://localhost:11434/v1/chat/completions) / LM Studio 等。",
  },
};
