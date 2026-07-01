import { App, MarkdownView, normalizePath, TFile } from "obsidian";
import type { Scan2mdSettings } from "./settings";

/** 去掉文件名里的非法字符。 */
function sanitize(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Scan"
  );
}

/** 确保目录存在（已存在或创建失败则忽略）。 */
async function ensureFolder(app: App, folder: string): Promise<void> {
  if (!folder || folder === "/" || folder === ".") return;
  if (app.vault.getAbstractFileByPath(folder)) return;
  try {
    await app.vault.createFolder(folder);
  } catch {
    // 可能已被并发创建，忽略
  }
}

/** 若路径已存在，追加 " (1)"、" (2)" 直至不冲突。 */
function uniquePath(app: App, path: string): string {
  if (!app.vault.getAbstractFileByPath(path)) return path;
  const dot = path.lastIndexOf(".");
  const base = dot > 0 ? path.slice(0, dot) : path;
  const ext = dot > 0 ? path.slice(dot) : "";
  let i = 1;
  while (app.vault.getAbstractFileByPath(`${base} (${i})${ext}`)) i++;
  return `${base} (${i})${ext}`;
}

export interface SaveInput {
  markdown: string;
  images: ArrayBuffer[];
  imageExt: string;
  title?: string;
  createdAt: string; // ISO 时间
}

/**
 * 把识别出的 Markdown 插入当前活动笔记的光标处（纯文本，不附图、不加 frontmatter）。
 * 没有打开的 Markdown 笔记时抛错，由调用方提示用户先打开笔记。返回笔记路径。
 */
export async function insertIntoActiveNote(
  app: App,
  markdown: string
): Promise<string> {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (!view || !view.file) {
    throw new Error(
      "当前没有打开的 Markdown 笔记。请先在电脑端打开一个笔记、把光标放在要插入的位置，再拍照上传。"
    );
  }
  const editor = view.editor;
  const cursor = editor.getCursor();
  // 光标之前若已有文字，前面补空行；否则只补一个换行 —— 保证表格/标题等块级元素前后有空行，正确渲染
  const before = editor.getRange({ line: cursor.line, ch: 0 }, cursor);
  const prefix = before.trim().length > 0 ? "\n\n" : "\n";
  const insert = prefix + markdown + "\n";
  editor.replaceRange(insert, cursor);
  // 光标移到插入内容末尾
  const nl = (insert.match(/\n/g) || []).length;
  const afterLastNl = insert.slice(insert.lastIndexOf("\n") + 1);
  editor.setCursor({
    line: cursor.line + nl,
    ch: (nl === 0 ? cursor.ch : 0) + afterLastNl.length,
  });
  return view.file.path;
}

/** 把识别出的 Markdown 写成笔记，并把图片作为附件引用到笔记顶部。返回笔记路径。 */
export async function saveScan(
  app: App,
  settings: Scan2mdSettings,
  input: SaveInput
): Promise<string> {
  const folder = normalizePath(settings.outputFolder || "/");
  await ensureFolder(app, folder);

  const m = (window as any).moment;
  const ts = m
    ? m(input.createdAt).format("YYYY-MM-DD HHmm")
    : input.createdAt.slice(0, 16).replace("T", " ");
  const base =
    input.title && input.title.trim()
      ? sanitize(input.title)
      : sanitize((settings.titleTemplate || "Scan {{DATE}}").replace(/\{\{DATE\}\}/g, ts));

  let body = input.markdown;
  if (settings.attachImages && input.images.length) {
    const attFolder = normalizePath(settings.attachmentFolder || folder);
    await ensureFolder(app, attFolder);
    const links: string[] = [];
    for (let i = 0; i < input.images.length; i++) {
      const imgName = `${base} - ${i + 1}.${input.imageExt}`;
      const imgPath = uniquePath(app, normalizePath(`${attFolder}/${imgName}`));
      await app.vault.createBinary(imgPath, input.images[i]);
      links.push(`![[${imgName}]]`);
    }
    body = `${links.join("\n")}\n\n${input.markdown}`;
  }

  const frontmatter = `---\ncreated: ${input.createdAt}\nsource: scan2md\n---\n\n`;
  const notePath = uniquePath(app, normalizePath(`${folder}/${base}.md`));
  await app.vault.create(notePath, frontmatter + body);

  if (settings.openAfterSave) {
    const file = app.vault.getAbstractFileByPath(notePath);
    if (file instanceof TFile) await app.workspace.getLeaf().openFile(file);
  }
  return notePath;
}
