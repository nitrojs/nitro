// Bundled as a standalone entry (see `build.config.ts`), so `rangi` is inlined and not a runtime dependency.
import { tokenize } from "rangi/core";
import { js, js_template_literals, jsdoc, json, regex, todo, ts } from "rangi/languages";
import type { HighlightToken } from "./_utils.ts";

const languages = { js, ts, json, jsdoc, js_template_literals, regex, todo };

const extToLang: Record<string, string> = {
  js: "js",
  mjs: "js",
  cjs: "js",
  jsx: "js",
  ts: "ts",
  mts: "ts",
  cts: "ts",
  tsx: "ts",
  json: "json",
};

/**
 * Tokenize `code` and group the tokens by line.
 *
 * Extensionless files (virtual modules) are highlighted as JS. Files with an unknown extension
 * (or no `file`) yield a single untyped token per line.
 */
export function highlightLines(code: string, file?: string): HighlightToken[][] {
  const ext = file?.match(/\.(\w+)(?:\?.*)?$/)?.[1];
  const lang = file ? (ext ? extToLang[ext] : "js") : undefined;
  const tokens: HighlightToken[] = lang ? tokenize(code, { lang, languages }) : [{ text: code }];
  const lines: HighlightToken[][] = [[]];
  for (const { text, type } of tokens) {
    const parts = text.split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        lines.push([]);
      }
      const line = lines.at(-1)!;
      const last = line.at(-1);
      if (parts[i] && last && last.type === type) {
        last.text += parts[i];
      } else if (parts[i]) {
        line.push({ text: parts[i]!, type });
      }
    }
  }
  return lines;
}
