import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type Scan2mdPlugin from "./main";
import { DEFAULT_PROMPT } from "./converter";
import { PROVIDER_PRESETS, type Provider } from "./presets";
import { listModels } from "./models";
import { ModelSuggest } from "./model-suggest";

export interface Scan2mdSettings {
  provider: Provider;
  apiKey: string;
  model: string;
  /** 写入方式：insert=插入当前笔记光标处；newNote=新建独立笔记（附图存档）。 */
  writeMode: "insert" | "newNote";
  /** 留空用服务商默认地址；填了则覆盖。openai-compat 这里是完整 chat/completions 地址。 */
  apiBase: string;
  outputFolder: string;
  attachmentFolder: string;
  port: number;
  prompt: string;
  titleTemplate: string; // 支持 {{DATE}}
  maxImageWidth: number;
  jpegQuality: number; // 0~1
  attachImages: boolean;
  openAfterSave: boolean;
}

export const DEFAULT_SETTINGS: Scan2mdSettings = {
  provider: "claude",
  apiKey: "",
  model: "claude-sonnet-4-6",
  writeMode: "insert",
  apiBase: "",
  outputFolder: "Scans",
  attachmentFolder: "Scans/attachments",
  port: 43112,
  prompt: DEFAULT_PROMPT,
  titleTemplate: "Scan {{DATE}}",
  maxImageWidth: 1600,
  jpegQuality: 0.8,
  attachImages: true,
  openAfterSave: true,
};

export class Scan2mdSettingTab extends PluginSettingTab {
  plugin: Scan2mdPlugin;

  constructor(app: App, plugin: Scan2mdPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    const preset = PROVIDER_PRESETS[s.provider];
    containerEl.empty();

    new Setting(containerEl).setName("识别引擎").setHeading();

    new Setting(containerEl)
      .setName("服务商")
      .setDesc("选择用于图像识别的视觉大模型；国产厂商均走 OpenAI 兼容接口。")
      .addDropdown((dd) => {
        for (const key of Object.keys(PROVIDER_PRESETS) as Provider[]) {
          dd.addOption(key, PROVIDER_PRESETS[key].label);
        }
        dd.setValue(s.provider);
        dd.onChange(async (v) => {
          const p = v as Provider;
          s.provider = p;
          const next = PROVIDER_PRESETS[p];
          s.model = next.defaultModel;
          s.apiBase = ""; // 切换后用新服务商的默认端点
          this.plugin.availableModels = []; // 不同厂商模型列表不同，清空缓存
          await this.plugin.saveSettings();
          this.display(); // 刷新说明与 placeholder
        });
      });

    new Setting(containerEl)
      .setName("当前服务商说明")
      .setDesc(
        preset.note +
          " 可在「模型名」右侧点刷新按钮，拉取该 API 支持的模型列表后选取。"
      );

    new Setting(containerEl)
      .setName("写入方式")
      .setDesc(
        "「插入当前笔记光标处」：识别后直接写入当前打开笔记的光标位置，不附图、不新建笔记；「新建独立笔记」：每次生成一个独立笔记（可附原图存档）。"
      )
      .addDropdown((dd) => {
        dd.addOption("insert", "插入当前笔记光标处（不附图）");
        dd.addOption("newNote", "新建独立笔记（可附图存档）");
        dd.setValue(s.writeMode);
        dd.onChange(async (v) => {
          s.writeMode = v as Scan2mdSettings["writeMode"];
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("API key")
      .setDesc("对应服务商的密钥，仅保存在本库的插件配置中。")
      .addText((t) => {
        t.inputEl.type = "password";
        t.setPlaceholder("sk-… / AIza… / 你的厂商 key");
        t.setValue(s.apiKey);
        t.onChange(async (v) => {
          s.apiKey = v.trim();
          this.plugin.availableModels = []; // key 变了，模型列表可能不同
          await this.plugin.saveSettings();
        });
      });

    // 模型名：可搜索输入框（输入联想已拉取的模型）+ 「获取模型列表」刷新按钮
    let modelSuggest: ModelSuggest | null = null;
    new Setting(containerEl)
      .setName("模型名")
      .setDesc("留空用服务商默认模型；建议点右侧按钮拉取列表后选取，避免手填出错。")
      .addText((t) => {
        t.setPlaceholder(preset.defaultModel || "如 qwen-vl-max-latest").setValue(
          s.model
        );
        modelSuggest = new ModelSuggest(
          this.app,
          t.inputEl,
          this.plugin.availableModels
        );
        t.onChange(async (v) => {
          s.model = v.trim();
          await this.plugin.saveSettings();
        });
      })
      .addExtraButton((btn) => {
        btn
          .setIcon("refresh-cw")
          .setTooltip("获取模型列表")
          .onClick(async () => {
            if (!s.apiKey) {
              new Notice("请先填写 API Key");
              return;
            }
            new Notice("正在获取模型列表…");
            try {
              const models = await listModels(s);
              if (!models.length) {
                new Notice("未获取到模型，请检查 Key / 端点或在官网确认");
                return;
              }
              this.plugin.availableModels = models;
              modelSuggest?.setModels(models);
              new Notice(`已获取 ${models.length} 个模型，可在输入框中搜索选取`);
            } catch (e: any) {
              new Notice("获取失败：" + (e?.message || e), 10000);
            }
          });
      });

    new Setting(containerEl)
      .setName("API 端点（可选）")
      .setDesc("留空用服务商默认地址；填了则覆盖（走代理/网关/自建端点）。")
      .addText((t) =>
        t
          .setPlaceholder(preset.endpoint || "https://…/chat/completions")
          .setValue(s.apiBase)
          .onChange(async (v) => {
            s.apiBase = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("提示词")
      .setDesc("控制模型如何把图片转成 Markdown。留空用默认。")
      .addTextArea((ta) => {
        ta.setValue(s.prompt).onChange(async (v) => {
          s.prompt = v;
          await this.plugin.saveSettings();
        });
        ta.inputEl.rows = 5;
        ta.inputEl.setCssStyles({ width: "100%" });
      });

    new Setting(containerEl).setName("笔记与存储").setHeading();

    new Setting(containerEl)
      .setName("输出文件夹")
      .setDesc("生成的 Markdown 笔记存放位置。")
      .addText((t) =>
        t.setValue(s.outputFolder).onChange(async (v) => {
          s.outputFolder = v.trim() || "Scans";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("图片附件文件夹")
      .setDesc("原图存放位置；会在笔记顶部用 ![[...]] 引用。")
      .addText((t) =>
        t.setValue(s.attachmentFolder).onChange(async (v) => {
          s.attachmentFolder = v.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("笔记标题模板")
      .setDesc("支持 {{DATE}}（如 Scan 2026-06-29 1430）。手机端填写了标题时以标题为准。")
      .addText((t) =>
        t.setValue(s.titleTemplate).onChange(async (v) => {
          s.titleTemplate = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("保存后打开笔记")
      .setDesc("识别完成并写入后，自动在新标签页打开。")
      .addToggle((tg) =>
        tg.setValue(s.openAfterSave).onChange(async (v) => {
          s.openAfterSave = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("保存原图到笔记")
      .setDesc("把拍摄的图片存为附件并在笔记顶部引用（仅「新建独立笔记」模式生效）。")
      .addToggle((tg) =>
        tg.setValue(s.attachImages).onChange(async (v) => {
          s.attachImages = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("网络与图片").setHeading();

    new Setting(containerEl)
      .setName("本地端口")
      .setDesc("HTTP 服务监听端口。改了之后用命令面板 “scan2MD: 重启本地服务器”。")
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(s.port));
        t.onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n > 0 && n < 65536) {
            s.port = n;
            await this.plugin.saveSettings();
          }
        });
      });

    new Setting(containerEl)
      .setName("图片最大宽度（像素）")
      .setDesc("上传前在手机端压缩到该宽度，省流量和 token。")
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(s.maxImageWidth));
        t.onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n > 0) {
            s.maxImageWidth = n;
            await this.plugin.saveSettings();
          }
        });
      });

    new Setting(containerEl)
      .setName("JPEG 质量")
      .setDesc("0~1，越大越清晰、体积越大。")
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(s.jpegQuality));
        t.onChange(async (v) => {
          const n = parseFloat(v);
          if (!isNaN(n) && n > 0 && n <= 1) {
            s.jpegQuality = n;
            await this.plugin.saveSettings();
          }
        });
      });
  }
}
