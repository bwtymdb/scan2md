# Scan to Markdown

用手机扫码拍照，把书本、公式、表格等内容转成结构化 Markdown，直接写进 Obsidian 笔记。

手机和电脑连同一个 WiFi，在 Obsidian 里打开扫码面板 → 手机扫码进入拍照网页 →
拍摄或选择图片 → 插件调用视觉大模型转成 Markdown → 写入你当前打开的笔记（或另存为新笔记）。

> 仅支持桌面端 Obsidian（需要 Node 能力来跑本地 HTTP 服务器；移动端不支持）。
> 蓝牙不适合此场景（无法传输摄像头画面），统一走同一 WiFi。

## 功能特性

- **扫码即拍**：手机扫码打开网页，用摄像头连续拍多页，或从相册选图。
- **两种写入方式**：
  - **插入当前笔记光标处**（默认）：识别结果直接写到当前打开笔记的当前光标位置，纯 Markdown、不附图。
  - **新建独立笔记**：每次生成一个独立笔记，可附带原图存档。
- **公式支持**：数学公式用 LaTeX（行内 `$...$`、块级 `$$...$$`），自动规范化常见定界符问题，确保在 Obsidian 正常渲染。
- **结构化排版**：保留标题层级、段落、列表、表格、加粗/斜体。
- **多服务商**：内置 Claude / Gemini / OpenAI 及通义千问、智谱 GLM、豆包、Kimi、文心、混元等国产厂商预设；填入 API Key 后可一键拉取该 API 支持的模型列表并在输入框搜索选取。
- **本地运行**：识别逻辑全部在本地插件内，图片仅发往你配置的 LLM 服务商。

## 工作原理

```
手机浏览器 ──扫码──> 插件内置网页 (GET /)
   │  getUserMedia 拍照 / 选图，canvas 压缩
   ▼ POST /api/upload（base64 + JSON，带一次性 token）
插件本地 HTTP 服务器（Node http，端口默认 43112）
   │  requestUrl 调视觉模型 API
   ▼
视觉大模型 ──返回 Markdown──>
   ▼
Obsidian：插入当前笔记光标处 / 新建笔记
```

## 隐私与安全

- **API Key 存储**：仅保存在你本地库的插件配置文件（`<vault>/.obsidian/plugins/scan2md/data.json`），不会上传到任何第三方服务器，也不包含在插件源码里。
- **图片数据流向**：拍摄的图片以 base64 形式经本地 HTTP 服务发往**你选择并配置的 LLM 服务商**（如智谱、OpenAI 等）进行识别。除该服务商外，图片不会发往其他任何地方。使用即视为你信任所选服务商的隐私政策。
- **本地 HTTP 服务**：插件在 `0.0.0.0:<端口>`（默认 43112）起一个本地服务器供手机访问，同一 WiFi 内的设备可连接。上传接口带启动时生成的一次性 token 校验。**不建议在公共/不可信网络下开启**；如需限制，可在防火墙关闭该端口的外部访问。
- **无遥测**：插件自身不收集、不上报任何使用数据。
- **网络请求**：均通过 Obsidian 官方 `requestUrl`（手机端网页内用浏览器原生 fetch 上传到本地服务）。

## 支持的服务商

设置 → 服务商里选择。除 Claude / Gemini 外，其余均走 OpenAI 兼容接口：

| 服务商 | 说明 |
| --- | --- |
| Claude（Anthropic） | Anthropic Messages API |
| Gemini（Google） | Gemini generateContent |
| OpenAI | OpenAI 兼容 |
| 通义千问（阿里） | 百炼 DashScope 兼容 |
| 智谱 GLM | 智谱开放平台兼容 |
| 豆包（字节火山方舟） | 火山方舟兼容（需创建推理接入点） |
| Kimi（月之暗面） | Moonshot 兼容 |
| 文心（百度） | 千帆 OpenAI 兼容 v2 |
| 混元（腾讯） | 腾讯云混元兼容 |
| 自定义 OpenAI 兼容端点 | MiniMax / DeepSeek / Ollama / LM Studio 等 |

填入 API Key 后，点「模型名」右侧的刷新按钮可拉取该 API 当前支持的模型列表并在输入框搜索选取，无需手动查找模型名。

## 安装

### 从社区插件市场安装（上架后）
Obsidian 设置 → 第三方插件 → 浏览 → 搜索 "Scan to Markdown" → 安装并启用。

### 手动安装（从 Release）
1. 从 GitHub Release 下载 `main.js`、`manifest.json`、`styles.css`。
2. 拷进 `<你的库>/.obsidian/plugins/scan2md/`。
3. Obsidian 设置 → 第三方插件 → 启用 "Scan to Markdown"。

### 从源码构建
```bash
npm install
npm run build   # 生成 main.js
```

## 使用

1. 插件设置：选择**服务商**、填 **API Key**（点模型名旁的按钮拉取模型列表选取）、选**写入方式**、设置端口（默认 43112）。
2. 命令面板 → `scan2MD: 打开扫码面板`（或左侧 Ribbon 图标）。
3. 手机连同一 WiFi，扫弹窗里的二维码 → 网页拍照/选图 → 「识别并插入」/「生成笔记」。
4. 内容写入当前笔记光标处（或新建笔记，取决于写入方式设置）。

> 写入当前笔记模式下：拍照前请把光标放在目标位置；若当前没有打开的笔记，手机端会提示先打开一个。

## 说明与注意

- **摄像头权限**：手机浏览器对局域网 HTTP 调用 `getUserMedia` 通常允许；若被拦截，网页会自动出现「从相册/拍照选择」按钮作为兜底。
- **成本**：视觉模型按 token 计费，网页端默认把图片压缩到宽度 ≤1600px、JPEG 质量 0.8，可在设置里调整。
- **多网卡**：若扫码地址不是局域网 IP，在扫码面板切换 IP 或手动输入。

## 开发

- `npm run dev`：esbuild watch。
- `npm run typecheck`：类型检查。

## 许可证

[MIT](./LICENSE)
