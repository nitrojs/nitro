import { definePlugin } from "nitro";
import type { NitroApp, NitroAppPlugin } from "nitro/types";
import type { IAnyValue, IKeyValue, SpanInfo } from "./types.ts";
import { Span } from "./span.ts";
import { subscribeTracedChannels } from "./subscribe.ts";

interface CollectedSpan {
  name: string;
  attributes: IKeyValue[];
  start: bigint;
  end: bigint;
  error: unknown;
}

interface RequestTrace {
  start: bigint;
  method: string;
  path: string;
  spans: CollectedSpan[];
}

/**
 * Built-in telemetry sink that renders each request's tracing-channel spans as a
 * console timeline (waterfall), enabled via `experimental.tracingLogger`. A
 * dependency-free, platform-agnostic alternative to a vendor sink (e.g. the
 * Vercel exporter) — useful for local development and seeing what Nitro spends
 * time on per request.
 *
 * Spans are grouped per request via async context: a collector is seeded on the
 * `request` hook (which runs inside the request's async context, in every
 * environment), so each nested operation (routing, storage, …) lands in that
 * request's collector, isolated from other in-flight requests. The timeline is
 * flushed on the `response` hook.
 */
const plugin: NitroAppPlugin = definePlugin((nitroApp: NitroApp) => {
  const proc = globalThis.process;
  const diagnostics = proc?.getBuiltinModule?.("node:diagnostics_channel");
  const asyncHooks = proc?.getBuiltinModule?.("node:async_hooks");

  // Without async context (or the request hooks) there's no reliable way to
  // group spans per request — storage operations carry no request reference —
  // so fall back to a flat line per completed span.
  if (!diagnostics?.subscribe || !asyncHooks?.AsyncLocalStorage || !nitroApp?.hooks) {
    subscribeTracedChannels(logFlat);
    return;
  }

  const als = new asyncHooks.AsyncLocalStorage<RequestTrace>();

  // Seed a per-request collector. `enterWith` binds it to the request's async
  // context, so the traced operations below (and their `asyncEnd` continuations)
  // observe the same collector until the response is sent.
  nitroApp.hooks.hook("request", (event) => {
    als.enterWith({
      start: BigInt(Span.nowUnixNano()),
      method: event.req.method,
      path: new URL(event.req.url).pathname,
      spans: [],
    });
  });

  subscribeTracedChannels((info, start, error) => {
    const trace = als.getStore();
    // No active request (e.g. storage during plugin setup, or the platform's
    // outer request span that closes after the response) — nothing to attach to.
    if (!trace) return;
    trace.spans.push({
      name: info.name,
      attributes: info.attributes,
      start: BigInt(start),
      end: BigInt(Span.nowUnixNano()),
      error,
    });
  });

  nitroApp.hooks.hook("response", () => {
    const trace = als.getStore();
    if (trace) {
      console.log(renderTimeline(trace, BigInt(Span.nowUnixNano())));
    }
  });
});

export default plugin

// The waterfall track shrinks to fit narrow terminals but never below MIN.
const MAX_TRACK = 32;
const MIN_TRACK = 12;
// Fixed width of the tree + name column, so bars stay aligned across rows
// regardless of nesting depth.
const LABEL_WIDTH = 24;

// xterm-256 color codes, picked to stay legible on both light and dark terminals.
const RED = "38;5;203";
const AMBER = "38;5;214";
const GREEN = "38;5;42";
const GRAY = "38;5;245";

// Span categories → accent color, derived from the span's semantic attributes.
const CATEGORY_COLOR: Record<string, string> = {
  middleware: "38;5;170", // orchid
  route: "38;5;39", // azure
  storage: AMBER,
  http: "38;5;43", // teal
  other: GRAY,
};

// Attributes already conveyed by the header (method + path) — hidden per row.
const REDUNDANT_ATTRS = new Set(["http.request.method", "url.path"]);

// Per-span status markers, drawn (in the span's accent color) ahead of its name.
// A failed span reads as `✖ setItem redis`; a successful one as `● setItem redis`.
const MARKER_OK = "●";
const MARKER_FAILED = "✖";

/** Render a request's collected spans as a single multi-line waterfall (printed atomically). */
function renderTimeline(trace: RequestTrace, end: bigint): string {
  const t0 = trace.start;
  const total = end - t0 || 1n;
  const ordered = [...trace.spans].sort((a, b) =>
    a.start === b.start ? Number(b.end - a.end) : Number(a.start - b.start)
  );

  const proc = globalThis.process;
  const env = proc?.env || {};
  // Honor the NO_COLOR / FORCE_COLOR conventions, falling back to TTY detection.
  // In the dev worker (node:worker_threads) stdout is a pipe to the host, so
  // `isTTY`/`columns` are unset there — color and width come from FORCE_COLOR /
  // COLUMNS, which the host is expected to propagate into the worker env.
  const colors = env.NO_COLOR
    ? false
    : env.FORCE_COLOR
      ? env.FORCE_COLOR !== "0" && env.FORCE_COLOR !== "false"
      : !!proc?.stdout?.isTTY;
  const paint = (s: string, code: string) => (colors ? `\x1b[${code}m${s}\x1b[0m` : s);
  const dim = (s: string) => paint(s, "2");
  const sep = dim("│");

  // Without a known width (e.g. piped to a file) keep everything on one line, as
  // before. A real terminal reports its columns, so the track adapts and long
  // attribute lists wrap instead of being hard-wrapped mid-token by the shell.
  const cols = Number(proc?.stdout?.columns) || Number(env.COLUMNS);
  const width = cols > 0 ? cols : Infinity;
  const track =
    width === Infinity ? MAX_TRACK : clamp(width - LABEL_WIDTH - 14, MIN_TRACK, MAX_TRACK);

  const header =
    ` ${paint(` ${trace.method} `, `1;7;${verbColor(trace.method)}`)} ` +
    `${paint(trace.path, "1")}  ${sep}  ` +
    `${paint(ms(total), heat(Number(total) / 1e6, 50, 200))}  ${sep}  ` +
    dim(`${ordered.length} spans`);

  const prefixes = treePrefixes(ordered);
  // Continuation lines (wrapped attributes) sit under the bar, aligned past the
  // tree/name column so they read as a hanging detail of the row above.
  const contIndent = " ".repeat(LABEL_WIDTH + 3);
  const contWidth = Math.max(24, (width === Infinity ? 0 : width) - contIndent.length);

  const rows: string[] = [];
  ordered.forEach((span, i) => {
    const failed = span.error !== undefined;
    const accent = failed ? RED : CATEGORY_COLOR[categorize(span)];
    const share = Number(span.end - span.start) / Number(total);

    const marker = failed ? MARKER_FAILED : MARKER_OK;
    const label = renderLabel(prefixes[i], marker, span.name, accent, paint, dim);
    const bar = renderBar(span, t0, total, track, accent, paint, dim);
    const duration = paint(ms(span.end - span.start).padStart(9), heat(share, 0.25, 0.6));
    const base = ` ${label} ${bar} ${duration}`;
    const basePlainLen = LABEL_WIDTH + track + 12;

    const shown = span.attributes.filter((a) => !REDUNDANT_ATTRS.has(a.key));
    const tokens = shown.map(({ key, value }) => `${key}=${formatValue(value)}`);
    const errText = failed ? errorMessage(span.error) : "";
    const trailingLen = tokens.join(" ").length + (errText ? errText.length + 2 : 0);

    if (!tokens.length && !errText) {
      rows.push(base);
    } else if (basePlainLen + 2 + trailingLen <= width) {
      const attrs = tokens.length ? dim(tokens.join(" ")) : "";
      const err = errText ? paint(errText, RED) : "";
      rows.push(base + "  " + [attrs, err].filter(Boolean).join("  "));
    } else {
      // Row overflows this terminal — hang the details on wrapped lines.
      rows.push(base);
      for (const line of wrap(tokens, contWidth)) rows.push(contIndent + dim(line));
      for (const line of wrap(errText ? errText.split(/\s+/) : [], contWidth)) {
        rows.push(contIndent + paint(line, RED));
      }
    }
  });

  return ["", header, ...rows].join("\n");
}

/** A continuous baseline with a colored segment positioned by the span's window offset. */
function renderBar(
  span: CollectedSpan,
  t0: bigint,
  total: bigint,
  track: number,
  color: string,
  paint: (s: string, code: string) => string,
  dim: (s: string) => string
): string {
  const startCol = clamp(Number(((span.start - t0) * BigInt(track)) / total), 0, track - 1);
  const barLen = clamp(
    Number(((span.end - span.start) * BigInt(track)) / total),
    1,
    track - startCol
  );
  return (
    dim("─".repeat(startCol)) +
    paint("█".repeat(barLen), color) +
    dim("─".repeat(track - startCol - barLen))
  );
}

/**
 * Render the fixed-width tree + name column: a dim tree prefix, the accent
 * marker, then the (truncated) span name, padded so bars line up across rows.
 */
function renderLabel(
  prefix: string,
  marker: string,
  name: string,
  accent: string,
  paint: (s: string, code: string) => string,
  dim: (s: string) => string
): string {
  const budget = Math.max(1, LABEL_WIDTH - prefix.length - 2);
  const shown = name.length > budget ? name.slice(0, budget - 1) + "…" : name;
  const pad = " ".repeat(Math.max(0, LABEL_WIDTH - prefix.length - 2 - shown.length));
  return dim(prefix) + paint(marker, accent) + " " + paint(shown, accent) + pad;
}

/**
 * Assign each span a box-drawing tree prefix from parent/child nesting inferred
 * by time containment: a span whose window sits inside another's is drawn as its
 * child. Spans are already ordered by start (then longest first), so a stack of
 * still-open ancestors yields each span's parent in one pass.
 */
function treePrefixes(spans: CollectedSpan[]): string[] {
  const parent: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < spans.length; i++) {
    while (stack.length && spans[stack[stack.length - 1]].end < spans[i].end) stack.pop();
    parent[i] = stack.length ? stack[stack.length - 1] : -1;
    stack.push(i);
  }
  const isLast = spans.map((_, i) => !spans.some((__, j) => j > i && parent[j] === parent[i]));
  return spans.map((_, i) => {
    const chain: number[] = [];
    for (let p = parent[i]; p !== -1; p = parent[p]) chain.unshift(p);
    const bars = chain.map((a) => (isLast[a] ? "  " : "│ ")).join("");
    return bars + (isLast[i] ? "└─" : "├─");
  });
}

/** Greedy-pack space-separated tokens into lines no wider than `width`. */
function wrap(tokens: string[], width: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const tok of tokens) {
    if (!cur) cur = tok;
    else if (cur.length + 1 + tok.length <= width) cur += " " + tok;
    else {
      lines.push(cur);
      cur = tok;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Classify a span by its semantic attributes to pick an accent color. */
function categorize(span: CollectedSpan): keyof typeof CATEGORY_COLOR {
  let handlerType: string | null | undefined;
  let hasStorage = false;
  let hasSrvxMiddleware = false;
  let hasHttp = false;
  for (const { key, value } of span.attributes) {
    if (key === "db.operation") hasStorage = true;
    else if (key === "h3.handler_type") handlerType = value.stringValue;
    else if (key === "srvx.middleware.index") hasSrvxMiddleware = true;
    else if (key === "http.request.method") hasHttp = true;
  }
  if (hasStorage) return "storage";
  if (handlerType === "middleware" || hasSrvxMiddleware) return "middleware";
  if (handlerType === "route") return "route";
  if (hasHttp) return "http";
  return "other";
}

/** Heat color for a magnitude: green under `mid`, amber under `high`, red above. */
function heat(value: number, mid: number, high: number): string {
  return value >= high ? RED : value >= mid ? AMBER : GREEN;
}

/** Verb-specific header badge color. */
function verbColor(method: string): string {
  switch (method) {
    case "GET":
      return GREEN;
    case "POST":
      return AMBER;
    case "PUT":
    case "PATCH":
      return "38;5;39";
    case "DELETE":
      return RED;
    default:
      return "38;5;43";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** Nanoseconds (bigint) as a millisecond string, e.g. `1.23ms`. */
function ms(nanos: bigint): string {
  return `${(Number(nanos) / 1e6).toFixed(2)}ms`;
}

function logFlat(info: SpanInfo, startTimeUnixNano: string, error: unknown): void {
  const durationMs = Number(BigInt(Span.nowUnixNano()) - BigInt(startTimeUnixNano)) / 1e6;
  const attrs = info.attributes.length ? ` ${formatAttributes(info.attributes)}` : "";
  const line = `[trace] ${info.name} (${durationMs.toFixed(2)}ms)${attrs}`;
  if (error === undefined) {
    console.log(line);
  } else {
    console.error(line, error);
  }
}

function errorMessage(error: unknown): string {
  const message = (error as Partial<Error> | undefined)?.message;
  return typeof message === "string" ? message : String(error);
}

function formatAttributes(attributes: IKeyValue[]): string {
  return attributes.map(({ key, value }) => `${key}=${formatValue(value)}`).join(" ");
}

function formatValue(value: IAnyValue): string {
  if (value.stringValue != null) return value.stringValue;
  if (value.intValue != null) return String(value.intValue);
  if (value.doubleValue != null) return String(value.doubleValue);
  if (value.boolValue != null) return String(value.boolValue);
  return "";
}
