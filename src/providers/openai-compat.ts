import { requestUrl } from "obsidian";
import type { InputImage } from "./claude";

/**
 * 通用 OpenAI 兼容通道（chat/completions + image_url + Bearer 鉴权）。
 * 覆盖 OpenAI 以及绝大多数国产厂商（Qwen / GLM / 豆包 / Kimi / 文心 / 混元）和自建端点。
 */
export async function callOpenAICompat(
  endpoint: string,
  apiKey: string,
  model: string,
  images: InputImage[],
  prompt: string
): Promise<string> {
  const content: any[] = [{ type: "text", text: prompt }];
  for (const im of images) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${im.mediaType};base64,${im.b64}` },
    });
  }

  const resp = await requestUrl({
    url: endpoint,
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      max_tokens: 4096,
    }),
    throw: false,
  });

  const data = resp.json;
  if (resp.status >= 400 || data?.error) {
    const msg =
      data?.error?.message ||
      (typeof data?.error === "string" ? data.error : `API 返回状态 ${resp.status}`);
    throw new Error(msg);
  }

  // content 可能是字符串，也可能是数组（部分国产返回数组形式）
  const raw = data?.choices?.[0]?.message?.content;
  const text = extractText(raw);
  if (!text) throw new Error("模型返回内容为空");
  return text;
}

function extractText(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p: any) =>
        typeof p === "string" ? p : typeof p?.text === "string" ? p.text : ""
      )
      .filter(Boolean)
      .join("\n");
  }
  return "";
}
