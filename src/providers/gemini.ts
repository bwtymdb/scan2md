import { requestUrl } from "obsidian";
import type { Scan2mdSettings } from "../settings";
import type { InputImage } from "./claude";

/** 调用 Google Gemini generateContent（视觉），返回模型输出的 Markdown 文本。 */
export async function convertWithGemini(
  settings: Scan2mdSettings,
  images: InputImage[],
  prompt: string
): Promise<string> {
  const apiBase =
    (settings.apiBase || "").trim() || "https://generativelanguage.googleapis.com";
  const parts: any[] = [{ text: prompt }];
  for (const im of images) {
    parts.push({ inlineData: { mimeType: im.mediaType, data: im.b64 } });
  }
  const model = settings.model || "gemini-1.5-pro";

  const resp = await requestUrl({
    url: `${apiBase}/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(settings.apiKey)}`,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
    throw: false,
  });

  const data = resp.json;
  if (resp.status >= 400 || data?.error) {
    throw new Error(data?.error?.message || `Gemini API 返回状态 ${resp.status}`);
  }
  const partsArr: any[] = data?.candidates?.[0]?.content?.parts || [];
  const text = partsArr
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n");
  if (!text) throw new Error("Gemini 返回内容为空");
  return text;
}
