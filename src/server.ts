import * as http from "http";
import type Scan2mdPlugin from "./main";
import { renderCapturePage } from "./capture-page";
import { convertImages } from "./converter";
import { insertIntoActiveNote, saveScan } from "./vault-writer";

/**
 * 本地 HTTP 服务器（Node http 模块）。
 * - GET /        手机拍照网页
 * - GET /health  存活检查
 * - POST /api/upload  接收 {title?, images:[base64...]}，转 Markdown 并写入 Vault
 *   上传需带 x-scan-token 头（与启动时生成的 token 一致）。
 */
export class CaptureServer {
  plugin: Scan2mdPlugin;
  server: http.Server | null = null;
  port = 0;
  token = "";

  constructor(plugin: Scan2mdPlugin) {
    this.plugin = plugin;
  }

  start(port: number, token: string): Promise<void> {
    this.port = port;
    this.token = token;
    return new Promise((resolve, reject) => {
      const srv = http.createServer((req, res) => {
        // 不 await：每个请求独立处理，异常在内部捕获
        void this.handle(req, res);
      });
      srv.on("error", reject);
      srv.listen(port, "0.0.0.0", () => {
        this.server = srv;
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      const method = (req.method || "GET").toUpperCase();

      if (method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        const html = renderCapturePage({
          token: this.token,
          maxWidth: this.plugin.settings.maxImageWidth,
          quality: this.plugin.settings.jpegQuality,
          mode: this.plugin.settings.writeMode,
        });
        this.send(res, 200, "text/html; charset=utf-8", html);
        return;
      }

      if (method === "GET" && url.pathname === "/health") {
        this.send(res, 200, "application/json", JSON.stringify({ ok: true }));
        return;
      }

      if (method === "POST" && url.pathname === "/api/upload") {
        await this.handleUpload(req, res);
        return;
      }

      this.send(res, 404, "application/json", JSON.stringify({ error: "not found" }));
    } catch (e: any) {
      this.send(
        res,
        500,
        "application/json",
        JSON.stringify({ error: e?.message || "server error" })
      );
    }
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
  }

  private async handleUpload(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const token = req.headers["x-scan-token"];
    if (!token || token !== this.token) {
      this.send(res, 401, "application/json", JSON.stringify({ error: "未授权" }));
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(await this.readBody(req));
    } catch {
      this.send(res, 400, "application/json", JSON.stringify({ error: "请求格式错误" }));
      return;
    }

    const images64: string[] = Array.isArray(payload?.images) ? payload.images : [];
    if (!images64.length) {
      this.send(res, 400, "application/json", JSON.stringify({ error: "没有图片" }));
      return;
    }

    // base64 → InputImage（喂模型用）；图片 ArrayBuffer 仅在「新建笔记」模式才需要
    const inputImages = [];
    for (const b64 of images64) {
      inputImages.push({ b64, mediaType: "image/jpeg" });
    }

    let markdown: string;
    try {
      markdown = await convertImages(this.plugin.settings, inputImages, inputImages.length > 1);
    } catch (e: any) {
      this.send(
        res,
        502,
        "application/json",
        JSON.stringify({ error: "识别失败：" + (e?.message || e) })
      );
      return;
    }

    const settings = this.plugin.settings;

    // 写入方式：插入当前笔记光标处（不附图、不新建笔记）
    if (settings.writeMode === "insert") {
      let path: string;
      try {
        path = await insertIntoActiveNote(this.plugin.app, markdown);
      } catch (e: any) {
        this.send(
          res,
          400,
          "application/json",
          JSON.stringify({ error: e?.message || e })
        );
        return;
      }
      this.send(
        res,
        200,
        "application/json",
        JSON.stringify({ ok: true, mode: "insert", path })
      );
      return;
    }

    // 写入方式：新建独立笔记（可附原图存档）
    const images: ArrayBuffer[] = [];
    for (const b64 of images64) {
      const buf = Buffer.from(b64, "base64");
      images.push(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    }
    let notePath: string;
    try {
      notePath = await saveScan(this.plugin.app, settings, {
        markdown,
        images,
        imageExt: "jpg",
        title: payload?.title,
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      this.send(
        res,
        500,
        "application/json",
        JSON.stringify({ error: "保存失败：" + (e?.message || e) })
      );
      return;
    }

    this.send(
      res,
      200,
      "application/json",
      JSON.stringify({ ok: true, mode: "newNote", path: notePath })
    );
  }

  private send(
    res: http.ServerResponse,
    status: number,
    contentType: string,
    body: string
  ): void {
    res.writeHead(status, {
      "content-type": contentType,
      "access-control-allow-origin": "*",
    });
    res.end(body);
  }
}
