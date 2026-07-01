import { AbstractInputSuggest, App } from "obsidian";

/**
 * 模型名可搜索下拉：输入时从已拉取的模型列表联想过滤，选中后写回输入框。
 * 基于 Obsidian 官方 AbstractInputSuggest，无需额外依赖。
 */
export class ModelSuggest extends AbstractInputSuggest<string> {
  private models: string[];
  readonly inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement, models: string[] = []) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.models = models;
  }

  /** 刷新后更新可选模型列表。 */
  setModels(models: string[]): void {
    this.models = models;
  }

  getSuggestions(query: string): string[] {
    const q = (query || "").trim().toLowerCase();
    const pool = q
      ? this.models.filter((m) => m.toLowerCase().includes(q))
      : this.models;
    return pool.slice(0, 50);
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    el.setText(value);
  }

  selectSuggestion(value: string): void {
    this.inputEl.value = value;
    // 触发 Setting 的 onChange，让模型名写回 settings
    this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    this.close();
  }
}
