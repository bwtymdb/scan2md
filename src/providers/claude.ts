import { requestUrl } from "obsidian";
import type { Scan2mdSettings } from "../settings";

export interface InputImage {
  b64: string;
  mediaType: string;
}

/** 调用 Anthropic Messages API（视觉），返回模型输出的 Markdown 文本。 */
export async function convertWithClaude(
  settings: Scan2mdSettings,
  images: InputImage[],
  prompt: string
): Promise<string> {
  const apiBase = (settings.apiBase || "").trim() || "https://api.anthropic.com";
  const content: any[] = images.map((im) => ({
    type: "image",
    source: { type: "base64", media_type: im.mediaType, data: im.b64 },
  }));
  content.push({ type: "text", text: prompt });

  const resp = await requestUrl({
    url: `${apiBase}/v1/messages`,
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: settings.model || "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    }),
    throw: false,
  });

  const data = resp.json;
  if (resp.status >= 400 || data?.error) {
    throw new Error(data?.error?.message || `Claude API 返回状态 ${resp.status}`);
  }
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string" || !text) throw new Error("Claude 返回内容为空");
  return text;
}
