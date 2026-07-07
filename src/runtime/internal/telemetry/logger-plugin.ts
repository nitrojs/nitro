import { definePlugin } from "nitro";
import type { NitroApp } from "nitro/types";
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
export default definePlugin((nitroApp: NitroApp) => {
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

const TRACK_WIDTH = 32;
const NAME_WIDTH = 22;

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

/** Render a request's collected spans as a single multi-line waterfall (printed atomically). */
function renderTimeline(trace: RequestTrace, end: bigint): string {
  const t0 = trace.start;
  const total = end - t0 || 1n;
  const ordered = [...trace.spans].sort((a, b) =>
    a.start === b.start ? Number(b.end - a.end) : Number(a.start - b.start)
  );

  const tty = !!globalThis.process?.stdout?.isTTY;
  const paint = (s: string, code: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
  const dim = (s: string) => paint(s, "2");
  const sep = dim("│");

  const header =
    ` ${paint(` ${trace.method} `, `1;7;${verbColor(trace.method)}`)} ` +
    `${paint(trace.path, "1")}  ${sep}  ` +
    `${paint(ms(total), heat(Number(total) / 1e6, 50, 200))}  ${sep}  ` +
    dim(`${ordered.length} spans`);

  const rows = ordered.map((span) => {
    const failed = span.error !== undefined;
    const accent = failed ? RED : CATEGORY_COLOR[categorize(span)];
    const durMs = Number(span.end - span.start) / 1e6;
    const share = Number(span.end - span.start) / Number(total);

    const gutter = paint(failed ? "◆" : "●", accent);
    const name = paint(padName(failed ? "✖ " + span.name : span.name), accent);
    const bar = renderBar(span, t0, total, accent, paint, dim);
    const duration = paint(ms(span.end - span.start).padStart(9), heat(share, 0.25, 0.6));

    const shown = span.attributes.filter((a) => !REDUNDANT_ATTRS.has(a.key));
    const attrs = shown.length ? "  " + dim(formatAttributes(shown)) : "";
    const err = failed ? "  " + paint(errorMessage(span.error), RED) : "";
    return ` ${gutter} ${name} ${bar} ${duration}${attrs}${err}`;
  });

  return ["", header, ...rows].join("\n");
}

/** A continuous baseline with a colored segment positioned by the span's window offset. */
function renderBar(
  span: CollectedSpan,
  t0: bigint,
  total: bigint,
  color: string,
  paint: (s: string, code: string) => string,
  dim: (s: string) => string
): string {
  const startCol = clamp(
    Number(((span.start - t0) * BigInt(TRACK_WIDTH)) / total),
    0,
    TRACK_WIDTH - 1
  );
  const barLen = clamp(
    Number(((span.end - span.start) * BigInt(TRACK_WIDTH)) / total),
    1,
    TRACK_WIDTH - startCol
  );
  return (
    dim("─".repeat(startCol)) +
    paint("█".repeat(barLen), color) +
    dim("─".repeat(TRACK_WIDTH - startCol - barLen))
  );
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

/** Pad or ellipsize a raw (uncolored) name to the fixed name column width. */
function padName(name: string): string {
  if (name.length > NAME_WIDTH) return name.slice(0, NAME_WIDTH - 1) + "…";
  return name + " ".repeat(NAME_WIDTH - name.length);
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
