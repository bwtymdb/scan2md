import { requestUrl } from "obsidian";
import type { Scan2mdSettings } from "./settings";
import { PROVIDER_PRESETS } from "./presets";

/**
 * 从 OpenAI 兼容的 chat/completions 端点推导出 /models 端点。
 * 例：https://open.bigmodel.cn/api/paas/v4/chat/completions
 *   → https://open.bigmodel.cn/api/paas/v4/models
 * 若传入的已是根地址（无 /chat/completions 后缀），直接拼接 /models。
 */
function deriveModelsEndpoint(endpoint: string): string {
  const clean = endpoint.split("?")[0].split("#")[0].replace(/\/+$/, "");
  if (/\/chat\/completions$/.test(clean)) {
    return clean.replace(/\/chat\/completions$/, "/models");
  }
  return clean + "/models";
}

function unique(values: string[]): string[] {
  return values.filter((v, i, a) => a.indexOf(v) === i);
}

/**
 * 拉取当前服务商支持的模型列表（用户填好 API Key 后调用）。
 * 按 provider kind 分发，复用各通道的鉴权风格（Bearer / x-api-key / key-in-query）。
 * 豆包（火山方舟）返回的是接入点 ep-xxx 而非模型名，详见 presets.ts 的 note。
 */
export async function listModels(settings: Scan2mdSettings): Promise<string[]> {
  const preset = PROVIDER_PRESETS[settings.provider];
  const apiKey = (settings.apiKey || "").trim();
  if (!apiKey) throw new Error("请先填写 API Key");

  if (preset.kind === "anthropic") {
    const base = (settings.apiBase || "").trim() || preset.endpoint;
    const resp = await requestUrl({
      url: `${base}/v1/models?limit=1000`,
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      throw: false,
    });
    const data = resp.json;
    if (resp.status >= 400 || data?.error) {
      throw new Error(data?.error?.message || `Anthropic 返回状态 ${resp.status}`);
    }
    const ids: string[] = (data?.data || [])
      .filter((m: any) => m?.type === "model" && typeof m?.id === "string")
      .map((m: any) => m.id);
    return unique(ids);
  }

  if (preset.kind === "gemini") {
    const base = (settings.apiBase || "").trim() || preset.endpoint;
    const resp = await requestUrl({
      url: `${base}/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1000`,
      method: "GET",
      headers: { "content-type": "application/json" },
      throw: false,
    });
    const data = resp.json;
    if (resp.status >= 400 || data?.error) {
      throw new Error(data?.error?.message || `Gemini 返回状态 ${resp.status}`);
    }
    const ids: string[] = (data?.models || [])
      .filter(
        (m: any) =>
          Array.isArray(m?.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes("generateContent")
      )
      .map((m: any) => (m?.name || "").replace(/^models\//, ""))
      .filter(Boolean);
    return unique(ids);
  }

  // openai-compat：OpenAI + 国产厂商 + 自定义端点
  const endpoint = (settings.apiBase || "").trim() || preset.endpoint;
  if (!endpoint) throw new Error("请填写 API 端点");
  const resp = await requestUrl({
    url: deriveModelsEndpoint(endpoint),
    method: "GET",
    headers: { authorization: `Bearer ${apiKey}` },
    throw: false,
  });
  const data = resp.json;
  if (resp.status >= 400 || data?.error) {
    const msg =
      data?.error?.message ||
      (typeof data?.error === "string" ? data.error : `API 返回状态 ${resp.status}`);
    throw new Error(msg);
  }
  let ids: string[] = [];
  if (Array.isArray(data?.data)) {
    ids = data.data
      .map((m: any) => (typeof m === "string" ? m : m?.id))
      .filter((v: any): v is string => typeof v === "string" && !!v);
  } else if (Array.isArray(data?.models)) {
    ids = data.models
      .map((m: any) => (typeof m === "string" ? m : m?.id || m?.name))
      .filter((v: any): v is string => typeof v === "string" && !!v);
  }
  return unique(ids);
}
