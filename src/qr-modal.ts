import { App, Modal, Notice } from "obsidian";
import qrcode from "qrcode-generator";

/**
 * 弹窗：显示连接二维码、URL，并提供 IP 切换 / 手动输入 / 复制 / 本机打开。
 * 支持多网卡：自动检测到的局域网 IP 会列在下拉里供切换；
 * 若没检测到可用 IP（或选错网卡），可在下方手动输入电脑的真实 IPv4。
 */
export class QrModal extends Modal {
  private ips: string[];
  private port: number;
  private currentIp: string;

  private svgWrap!: HTMLElement;
  private urlEl!: HTMLElement;
  private selectEl!: HTMLSelectElement;

  constructor(app: App, ips: string[], port: number) {
    super(app);
    this.ips = ips.length ? [...ips] : [];
    this.port = port;
    this.currentIp = this.ips[0] || "";
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    titleEl.setText("scan2MD · 扫码连接");
    contentEl.empty();
    contentEl.addClass("scan2md-qr-modal");

    contentEl.createEl("p", {
      text: "手机与电脑连同一个 WiFi，扫码打开拍照页面：",
    });

    if (!this.ips.length) {
      contentEl.createEl("p", {
        text: "⚠️ 未自动检测到可用的局域网 IP，请在下方手动输入电脑的 IPv4 地址（如 192.168.x.x）。",
        cls: "scan2md-warn",
      });
    }

    // IP 选择下拉
    const ipRow = contentEl.createDiv({ cls: "scan2md-iprow" });
    ipRow.createEl("span", { text: "IP：" });
    this.selectEl = ipRow.createEl("select");
    for (const ip of this.ips) {
      this.selectEl.createEl("option", { value: ip, text: ip });
    }
    this.selectEl.addEventListener("change", () => {
      this.currentIp = this.selectEl.value;
      this.renderQr();
    });

    this.svgWrap = contentEl.createDiv({ cls: "scan2md-qr-svg" });
    this.urlEl = contentEl.createDiv({ cls: "scan2md-url" });
    this.renderQr();

    // 手动输入兜底（自动检测选错网卡时，手填电脑真实 IP）
    const manualRow = contentEl.createDiv({ cls: "scan2md-manual" });
    const manualInput = manualRow.createEl("input", {
      type: "text",
      placeholder: "或手动输入电脑 IP，如 192.168.1.10",
    });
    manualInput.value = this.currentIp;
    const applyBtn = manualRow.createEl("button", { text: "生成二维码" });
    applyBtn.onclick = () => {
      const v = manualInput.value.trim();
      if (!v) {
        new Notice("请输入 IP");
        return;
      }
      if (!this.ips.includes(v)) {
        this.ips.push(v);
        this.selectEl.createEl("option", { value: v, text: `${v}（手动）` });
      }
      this.currentIp = v;
      this.selectEl.value = v;
      this.renderQr();
    };

    const btnRow = contentEl.createDiv({ cls: "scan2md-btnrow" });
    const copyBtn = btnRow.createEl("button", { text: "复制地址" });
    copyBtn.onclick = () => {
      navigator.clipboard
        .writeText(this.currentUrl())
        .then(() => new Notice("已复制地址"))
        .catch(() => new Notice("复制失败，请手动选择地址复制"));
    };
    const openBtn = btnRow.createEl("button", { text: "在本机打开" });
    openBtn.onclick = () => window.open(this.currentUrl(), "_blank");
  }

  private currentUrl(): string {
    return `http://${this.currentIp}:${this.port}/`;
  }

  private renderQr(): void {
    this.svgWrap.empty();
    const url = this.currentUrl();
    if (!this.currentIp) {
      this.svgWrap.createEl("div", { text: "请选择或输入 IP" });
      this.urlEl.setText("");
      return;
    }
    try {
      const qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      const svgStr = qr.createSvgTag({
        cellSize: 4,
        margin: 4,
        scalable: true,
      });
      this.svgWrap.empty();
      this.svgWrap.appendChild(
        new DOMParser().parseFromString(svgStr, "image/svg+xml").documentElement
      );
    } catch (e: any) {
      this.svgWrap.createEl("div", {
        text: "二维码生成失败：" + (e?.message || e),
      });
    }
    this.urlEl.setText(url);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
