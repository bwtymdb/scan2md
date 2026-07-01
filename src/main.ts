import * as crypto from "crypto";
import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, Scan2mdSettings, Scan2mdSettingTab } from "./settings";
import { CaptureServer } from "./server";
import { getLocalIps } from "./network";
import { QrModal } from "./qr-modal";

export default class Scan2mdPlugin extends Plugin {
  settings: Scan2mdSettings = DEFAULT_SETTINGS;
  server: CaptureServer | null = null;
  token = "";
  /** 当前 provider 的模型列表缓存（按需刷新，不持久化）。 */
  availableModels: string[] = [];

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new Scan2mdSettingTab(this.app, this));

    // 启动本地服务器（一次性 token，校验上传来源）
    this.token = crypto.randomBytes(16).toString("hex");
    this.server = new CaptureServer(this);
    try {
      await this.server.start(this.settings.port, this.token);
    } catch (e: any) {
      new Notice(
        `scan2MD: 本地服务启动失败（${e?.message || e}）。请检查端口 ${this.settings.port} 是否被占用。`,
        10000
      );
    }

    this.addRibbonIcon("scan", "scan2MD 扫码", () => this.openQr());

    this.addCommand({
      id: "open-qr",
      name: "打开扫码面板",
      callback: () => this.openQr(),
    });

    this.addCommand({
      id: "restart-server",
      name: "重启本地服务器",
      callback: async () => {
        if (!this.server) return;
        await this.server.stop();
        try {
          await this.server.start(this.settings.port, this.token);
          new Notice(`scan2MD: 服务器已重启（端口 ${this.settings.port}）`);
        } catch (e: any) {
          new Notice(`scan2MD: 重启失败（${e?.message || e}）`, 10000);
        }
      },
    });
  }

  async onunload(): Promise<void> {
    if (this.server) {
      await this.server.stop();
      this.server = null;
    }
  }

  openQr(): void {
    new QrModal(this.app, getLocalIps(), this.settings.port).open();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
