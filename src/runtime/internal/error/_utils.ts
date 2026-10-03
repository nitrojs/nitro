import { parse as parseCookie } from "cookie-es";
import { highlightLines } from "./_highlight.ts";
import { readFrameSource } from "./_sourcemap.ts";
import { displayPath, getFrames, loadStackTrace, relativePath, type StackFrame } from "./_stack.ts";

type Format = Parameters<typeof import("node:util").styleText>[0];

export interface ErrorPageOptions {
  status?: number;
  statusText?: string;
  request?: { method: string; url: string; headers: HeadersInit };
}

export interface HighlightToken {
  text: string;
  type?: string;
}

export interface CodeFrame {
  /** 1-based line number of the first line */
  start: number;
  /** 1-based line number of the error line */
  line: number;
  col?: number;
  /** Highlighted tokens per line */
  lines: HighlightToken[][];
}

const MAX_LINE_LENGTH = 1000;
const MAX_CODE_FRAMES = 10;
const MAX_JSON_HIGHLIGHT = 50_000;

const ansiTokenColors: Record<string, Format> = {
  kwd: "magenta",
  section: "magenta",
  str: "green",
  esc: "green",
  num: "yellow",
  bool: "yellow",
  func: "blue",
  class: "cyan",
  type: "cyan",
  cmnt: "gray",
  bracket: "gray",
};

const lightVars =
  "color-scheme:light;--sun:none;--moon:inline;--bg:#fff;--fg:#1f2328;--dim:#6e7781;--card:#f6f8fa;--line:#d8dee4;--red:#cf222e;--hl:#ffebe9;--kwd:#cf222e;--str:#0a3069;--num:#0550ae;--fn:#8250df;--type:#953800";
const darkVars =
  "color-scheme:dark;--sun:inline;--moon:none;--bg:#0d1117;--fg:#e6edf3;--dim:#8d96a0;--card:#161b22;--line:#30363d;--red:#ff7b72;--hl:#3d1d20;--kwd:#ff7b72;--str:#a5d6ff;--num:#79c0ff;--fn:#d2a8ff;--type:#ffa657";

const styles: string = /* css */ `
:root{${lightVars}}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){${darkVars}}}
:root[data-theme=dark]{${darkVars}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:auto;padding:32px 16px}
.block{position:relative}
.copy{position:absolute;z-index:1;top:8px;right:8px;padding:4px 8px;font:12px/16px system-ui,sans-serif;color:var(--dim);background:var(--bg);border:1px solid var(--line);border-radius:6px;cursor:pointer}
.copy:hover{color:var(--fg);border-color:var(--dim)}
.actions{position:absolute;top:32px;right:16px;display:flex;gap:8px}
.actions>.copy{position:static}
.actions>.theme{border-color:transparent;background:none}
.theme .sun{display:var(--sun)}
.theme .moon{display:var(--moon)}
.copy-loc{padding:0;font:inherit;text-align:left;color:var(--dim);background:none;border:0;cursor:pointer}
.copy-loc:hover{color:var(--fg);text-decoration:underline}
.copy-loc svg{margin-left:4px;vertical-align:-2px}
.cp,.done .ok{display:inline-flex;align-items:center;gap:4px}
.ok,.done .cp{display:none}
.done{color:var(--fg)}
.json{border:1px solid var(--line);border-radius:8px}
pre,.code,.frame,td{font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
h1{margin:0;font-size:20px;color:var(--red)}
h2{margin:24px 0 8px;font-size:15px}
h3{margin:16px 0 4px;font-size:13px;color:var(--dim)}
.status{margin:0 0 8px;color:var(--dim)}
.msg{margin:8px 0;font-size:15px;white-space:pre-wrap;overflow-wrap:anywhere}
.hint{margin:8px 0;color:var(--dim)}
.stack{margin:16px 0;padding:0;list-style:none;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.frame+.frame{border-top:1px solid var(--line)}
.frame summary,.frame>div{padding:6px 12px;overflow-wrap:anywhere}
.frame summary{cursor:pointer}
.native,.module{opacity:.6}
.loc{color:var(--dim)}
.code{padding:8px 0;background:var(--card);overflow-x:auto;border-top:1px solid var(--line)}
.code>div{padding:0 12px;white-space:pre;min-width:max-content}
.code .hl{background:var(--hl)}
.caret{color:var(--red);font-weight:bold}
.ln{display:inline-block;width:5ch;margin-right:16px;text-align:right;color:var(--dim);user-select:none}
.nested{margin:16px 0 0 4px;padding-left:16px;border-left:2px solid var(--line)}
.nested h1{font-size:16px}
table{width:100%;border-collapse:collapse}
td{padding:4px 8px;border-top:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}
td:first-child{width:1%;white-space:nowrap;color:var(--dim)}
.request p{overflow-wrap:anywhere}
@media(max-width:640px){td{display:block}td:first-child{width:auto;padding-bottom:0}td+td{padding-top:0;border-top:0}}
.kwd,.section{color:var(--kwd)}
.str,.esc{color:var(--str)}
.num,.bool{color:var(--num)}
.func{color:var(--fn)}
.class,.type{color:var(--type)}
.cmnt,.bracket{color:var(--dim)}
`
  .trim()
  .replaceAll("\n", "");

const icons =
  '<svg style="display:none"><symbol id="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol><symbol id="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></symbol><symbol id="i-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></symbol><symbol id="i-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12l5 5L20 6"/></symbol></svg>';

const themeButton =
  '<button type="button" class="copy theme" title="Toggle theme" aria-label="Toggle theme"><svg class="sun" width="14" height="14"><use href="#i-sun"/></svg><svg class="moon" width="14" height="14"><use href="#i-moon"/></svg></button>';

// Runs in <head> so a saved theme applies before first paint.
// `navigator.clipboard` is only available in secure contexts (fallback for e.g. LAN IPs over http)
const pageScript: string = /* js */ `
const root = document.documentElement;
try {
  root.dataset.theme = localStorage.getItem("nitro-error-theme") || "";
} catch {}
document.addEventListener("mousedown", (event) => {
  if (event.detail > 1 && event.target.closest("summary")) event.preventDefault();
});
document.addEventListener("click", async (event) => {
  if (event.target.closest(".theme")) {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try {
      localStorage.setItem("nitro-error-theme", root.dataset.theme);
    } catch {}
    return;
  }
  const btn = event.target.closest("button[data-text]");
  if (!btn) return;
  event.preventDefault();
  const text = btn.dataset.text;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  btn.classList.add("done");
  clearTimeout(btn.timer);
  btn.timer = setTimeout(() => btn.classList.remove("done"), 1500);
});
`
  .trim()
  .replace(/\n\s*/g, "");

/** Render a self-contained HTML error page with source-mapped, highlighted stack frames. */
export async function renderErrorHTML(
  error: unknown,
  opts: ErrorPageOptions = {}
): Promise<string> {
  await loadStackTrace(error).catch(() => {});
  const { name, message } = errorInfo(error);
  const status = opts.status ? `${opts.status}${opts.statusText ? ` ${opts.statusText}` : ""}` : "";
  const title = [status, `${name}: ${message.split("\n")[0]!.slice(0, 100)}`].filter(Boolean);
  const copyText =
    (opts.request ? `${opts.request.method} ${opts.request.url}\n\n` : "") +
    stripColors(await ansiError(error, new Set()));
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title.join(" - "))}</title><style>${styles}</style><script>${pageScript}</script></head><body>${icons}<main class="block"><div class="actions">${copyButton(copyText, { title: "Copy error", label: true })}${themeButton}</div>${
    status ? `<p class="status">${esc(status)}</p>` : ""
  }${await htmlError(error, new Set())}${opts.request ? htmlRequest(opts.request) : ""}</main></body></html>`;
}

/** Render an error (with code frame, stack and causes) for terminal output. */
export async function renderErrorANSI(error: unknown): Promise<string> {
  await loadStackTrace(error).catch(() => {});
  return ansiError(error, new Set());
}

/** Read and highlight the source lines around a frame location. */
export async function getCodeFrame(
  frame: StackFrame,
  opts: { context?: number } = {}
): Promise<CodeFrame | undefined> {
  if (!frame.line || frame.type === "native") {
    return;
  }
  const source = await readFrameSource(frame);
  if (!source) {
    return;
  }
  const context = opts.context ?? 5;
  const allLines = source.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  // Skip minified code
  if (frame.line > allLines.length || allLines[frame.line - 1]!.length > MAX_LINE_LENGTH) {
    return;
  }
  const start = Math.max(1, frame.line - context);
  const end = Math.min(allLines.length, frame.line + context);
  // Some context before the visible window lets multiline tokens (comments, templates) highlight correctly
  const tokenizeStart = Math.max(1, start - 50);
  const code = allLines
    .slice(tokenizeStart - 1, end)
    .map((line) => line.slice(0, MAX_LINE_LENGTH))
    .join("\n");
  const lines = highlightLines(code, frame.file);
  return { start, line: frame.line, col: frame.col, lines: lines.slice(start - tokenizeStart) };
}

// ---- HTML ----

async function htmlError(error: unknown, seen: Set<unknown>): Promise<string> {
  seen.add(error);
  const { name, message, hint } = errorInfo(error);
  let html = `<section class="error"><h1>${esc(name)}</h1><pre class="msg">${esc(message)}</pre>`;
  if (hint) {
    html += `<p class="hint">${esc(hint)}</p>`;
  }
  if (!(error instanceof Error)) {
    return html + "</section>";
  }
  html += await htmlFrames(getFrames(error));
  if (error.cause !== undefined) {
    html += `<div class="nested"><h2>Caused by</h2>${htmlJSON(error.cause)}</div>`;
  }
  const errors = error instanceof AggregateError ? error.errors.filter((e) => !seen.has(e)) : [];
  if (errors.length > 0) {
    html += `<div class="nested"><h2>Errors</h2>`;
    for (const item of errors) {
      html += await htmlError(item, seen);
    }
    html += "</div>";
  }
  return html + "</section>";
}

async function htmlFrames(frames: StackFrame[]): Promise<string> {
  if (frames.length === 0) {
    return "";
  }
  const focus = focusFrame(frames);
  const withCode = new Set(
    [focus, ...frames.filter((f) => f.type === "app").slice(0, MAX_CODE_FRAMES)].filter(Boolean)
  );
  const items = await Promise.all(
    frames.map(async (frame) => {
      const label = htmlFrameLabel(frame);
      const code = withCode.has(frame) ? await getCodeFrame(frame) : undefined;
      if (!code) {
        return `<li class="frame ${frame.type}"><div>${label}</div></li>`;
      }
      return `<li class="frame ${frame.type}"><details${frame === focus ? " open" : ""}><summary>${label}</summary>${htmlCode(code)}</details></li>`;
    })
  );
  return `<ol class="stack">${items.join("")}</ol>`;
}

function htmlJSON(value: unknown): string {
  const json = toJSON(value);
  const lines = highlightLines(json, json.length > MAX_JSON_HIGHLIGHT ? undefined : "cause.json");
  const html = lines.map((tokens) => `<div>${htmlTokens(tokens)}</div>`).join("");
  return `<div class="block">${copyButton(json, { label: true })}<div class="code json">${html}</div></div>`;
}

function htmlFrameLabel(frame: StackFrame): string {
  if (!frame.file) {
    return `<span class="fn">${esc(frame.raw.trim().replace(/^at /, ""))}</span>`;
  }
  const pos = [frame.line, frame.col].filter(Boolean).join(":");
  const location = `${displayPath(frame.file)}${pos ? `:${pos}` : ""}`;
  const fn = `<span class="fn">${frame.async ? "async " : ""}${esc(frame.fn || "<anonymous>")}</span>`;
  if (frame.type === "native") {
    return `${fn} <span class="loc">${esc(location)}</span>`;
  }
  const copyPath = `${relativePath(frame.file)}${pos ? `:${pos}` : ""}`;
  return `${fn} ${copyButton(copyPath, { className: "copy-loc", title: "Copy path", content: esc(location) })}`;
}

function htmlCode(code: CodeFrame): string {
  let html = "";
  for (const [i, tokens] of code.lines.entries()) {
    const n = code.start + i;
    html += `<div${n === code.line ? ` class="hl"` : ""}><span class="ln">${n}</span>${htmlTokens(tokens)}</div>`;
    if (n === code.line && code.col) {
      html += `<div class="caret"><span class="ln"></span>${caretPadding(tokens, code.col)}^</div>`;
    }
  }
  return `<div class="code">${html}</div>`;
}

function htmlTokens(tokens: HighlightToken[]): string {
  return tokens
    .map((t) => (t.type ? `<span class="${esc(t.type)}">${esc(t.text)}</span>` : esc(t.text)))
    .join("");
}

function copyButton(
  text: string,
  opts: { className?: string; title?: string; label?: boolean; content?: string } = {}
): string {
  const { className = "copy", title = "Copy", label, content = "" } = opts;
  const icon = (id: string) => `<svg width="14" height="14"><use href="#i-${id}"/></svg>`;
  const aria = content ? "" : ` aria-label="${title}"`;
  return `<button type="button" class="${className}" data-text="${esc(text)}" title="${title}"${aria}>${content}<span class="cp">${icon("copy")}${label ? "Copy" : ""}</span><span class="ok">${icon("ok")}${label ? "Copied!" : ""}</span></button>`;
}

function htmlRequest(request: NonNullable<ErrorPageOptions["request"]>): string {
  const headers = new Headers(request.headers);
  const cookies = parseCookie(headers.get("cookie") || "");
  const rows = (entries: [string, string | undefined][]) =>
    `<table>${entries.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v || "")}</td></tr>`).join("")}</table>`;
  let html = `<section class="request"><h2>Request</h2><p><b>${esc(request.method)}</b> ${esc(request.url)}</p>`;
  html += `<h3>Headers</h3>${rows([...headers.entries()].filter(([k]) => k !== "cookie"))}`;
  if (Object.keys(cookies).length > 0) {
    html += `<h3>Cookies</h3>${rows(Object.entries(cookies))}`;
  }
  return html + "</section>";
}

// ---- ANSI ----

async function ansiError(error: unknown, seen: Set<unknown>): Promise<string> {
  seen.add(error);
  if (!(error instanceof Error)) {
    return color("red", String(error));
  }
  const lines = [color("bold", color("red", `${error.name || "Error"}: ${error.message}`))];
  const hint = (error as { hint?: unknown }).hint;
  if (typeof hint === "string") {
    lines.push(color("dim", hint));
  }
  const frames = getFrames(error);
  const focus = focusFrame(frames);
  const code = focus && (await getCodeFrame(focus, { context: 2 }));
  if (code) {
    lines.push("", ansiCode(code));
  }
  if (frames.length > 0) {
    lines.push("", ...frames.map((frame) => ansiFrame(frame)));
  }
  const nested = [error.cause, ...(error instanceof AggregateError ? error.errors : [])];
  for (const [i, item] of nested.entries()) {
    if (item !== undefined && !seen.has(item)) {
      const label = i === 0 ? "[cause]" : `[errors][${i - 1}]`;
      lines.push("", `${color("gray", label)} ${await ansiError(item, seen)}`);
    }
  }
  return lines.join("\n");
}

function ansiFrame(frame: StackFrame): string {
  if (!frame.file) {
    return color("gray", `  ${frame.raw.trim()}`);
  }
  const location =
    displayPath(frame.file) + [frame.line, frame.col].map((n) => (n ? `:${n}` : "")).join("");
  const at = frame.async ? "at async" : "at";
  if (frame.type !== "app") {
    return color("gray", `  ${at} ${frame.fn ? `${frame.fn} (${location})` : location}`);
  }
  return `  ${color("gray", at)} ${frame.fn ? `${frame.fn} (${color("cyan", location)})` : color("cyan", location)}`;
}

function ansiCode(code: CodeFrame): string {
  const width = String(code.start + code.lines.length - 1).length;
  const out: string[] = [];
  for (const [i, tokens] of code.lines.entries()) {
    const n = code.start + i;
    const isLine = n === code.line;
    const gutter = `${isLine ? color("red", "❯") : " "} ${color("gray", `${String(n).padStart(width)} │`)}`;
    const text = tokens.map((t) =>
      t.type && ansiTokenColors[t.type] ? color(ansiTokenColors[t.type]!, t.text) : t.text
    );
    out.push(`  ${gutter} ${text.join("")}`);
    if (isLine && code.col) {
      out.push(
        `    ${color("gray", `${" ".repeat(width)} │`)} ${caretPadding(tokens, code.col)}${color("red", "^")}`
      );
    }
  }
  return out.join("\n");
}

// ---- Shared ----

function focusFrame(frames: StackFrame[]): StackFrame | undefined {
  return frames.find((f) => f.type === "app") || frames.find((f) => f.type === "module");
}

/** Whitespace prefix that aligns a caret below `col` (keeps tabs). */
function caretPadding(tokens: HighlightToken[], col: number): string {
  return tokens
    .map((t) => t.text)
    .join("")
    .slice(0, col - 1)
    .replace(/[^\t]/g, " ");
}

function toJSON(value: unknown): string {
  const seen = new WeakSet<object>();
  const json = JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === "bigint") return `${v}n`;
      if (typeof v === "function") return `[Function ${v.name || "anonymous"}]`;
      if (typeof v === "symbol") return v.toString();
      if (!v || typeof v !== "object") return v;
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
      if (!(v instanceof Error)) return v;
      return Object.assign({ name: v.name, message: v.message }, v, {
        stack: getFrames(v).map((frame) => stripColors(ansiFrame(frame)).trim()),
        errors: v instanceof AggregateError ? v.errors : undefined,
        cause: v.cause,
      });
    },
    2
  );
  return json ?? String(value);
}

function errorInfo(error: unknown): { name: string; message: string; hint?: string } {
  if (!(error instanceof Error)) {
    return { name: "Error", message: inspect(error) };
  }
  const hint = (error as { hint?: unknown }).hint;
  return {
    name: error.name || "Error",
    message: error.message,
    hint: typeof hint === "string" ? hint : undefined,
  };
}

function inspect(value: unknown): string {
  const util = globalThis.process?.getBuiltinModule?.("node:util");
  return util ? util.inspect(value) : String(value);
}

function color(format: Format, text: string): string {
  try {
    const { styleText } = globalThis.process.getBuiltinModule("node:util");
    return styleText(format, text, { stream: globalThis.process.stderr });
  } catch {
    return text;
  }
}

function stripColors(text: string): string {
  const util = globalThis.process?.getBuiltinModule?.("node:util");
  return util ? util.stripVTControlCharacters(text) : text;
}

function esc(str: string): string {
  return str.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
