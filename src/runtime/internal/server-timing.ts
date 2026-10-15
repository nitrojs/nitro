import type { H3Event, Middleware } from "h3";
import type { ServerRequest } from "srvx";
import type { NitroOptions } from "nitro/types";
import type { AsyncLocalStorage } from "node:async_hooks";

type ServerTimingOptions = Exclude<NitroOptions["serverTiming"], false>;

type MetricName = "kv" | "db" | "cache";

/** Busy time: `busy` only grows while an operation is in flight, so parallel operations count once. */
export interface ServerTimingMetric {
  count: number;
  inflight: number;
  since: number;
  busy: number;
  status?: Record<string, number>;
  label?: (metric: ServerTimingMetric) => string | undefined;
}

export interface ServerTimingContext {
  options: ServerTimingOptions;
  start: number;
  kv?: ServerTimingMetric;
  db?: ServerTimingMetric;
  cache?: ServerTimingMetric;
}

const kServerTiming = /* @__PURE__ */ Symbol.for("nitro.serverTiming");
const kNotFound = /* @__PURE__ */ Symbol.for("h3.notFound");

let _als: AsyncLocalStorage<ServerTimingContext> | null | undefined;

export function withServerTimingContext(
  handler: (req: ServerRequest) => Response | Promise<Response>,
  options: ServerTimingOptions
): (req: ServerRequest) => Response | Promise<Response> {
  const als = options.kv || options.db ? useALS() : undefined;
  return (req) => {
    const ctx: ServerTimingContext = { options, start: performance.now() };
    ((req.context ||= {}) as Record<symbol, unknown>)[kServerTiming] = ctx;
    return als ? als.run(ctx, handler, req) : handler(req);
  };
}

export const serverTimingMiddleware: Middleware = (event, next) =>
  appendServerTiming(event, next(), false);
// Keep `h3/tracing` from wrapping Nitro's own middleware.
(serverTimingMiddleware as { __traced__?: boolean }).__traced__ = true;

/** h3 merges no staged headers into error handler responses. */
export function serverTimingOnError(event: H3Event, response: unknown): unknown {
  return appendServerTiming(event, response, true);
}

export function getServerTimingContext(event?: unknown): ServerTimingContext | undefined {
  type EventLike = {
    context?: Record<symbol, unknown>;
    req?: { context?: Record<symbol, unknown> };
  };
  // Cached handlers swap `event.req` for a narrowed request without context.
  const context =
    (event as EventLike | undefined)?.context ?? (event as EventLike | undefined)?.req?.context;
  return (context?.[kServerTiming] as ServerTimingContext | undefined) ?? _als?.getStore();
}

export function beginOp(
  ctx: ServerTimingContext | undefined,
  name: MetricName,
  label?: ServerTimingMetric["label"]
): ServerTimingMetric | undefined {
  if (!ctx?.options[name]) {
    return;
  }
  const metric = (ctx[name] ??= { count: 0, inflight: 0, since: 0, busy: 0, label });
  metric.count++;
  if (metric.inflight++ === 0) {
    metric.since = performance.now();
  }
  return metric;
}

export function endOp(metric: ServerTimingMetric | undefined, status?: string): void {
  if (!metric) {
    return;
  }
  if (--metric.inflight === 0) {
    metric.busy += performance.now() - metric.since;
  }
  if (status) {
    metric.status ??= {};
    metric.status[status] = (metric.status[status] || 0) + 1;
  }
}

export function formatServerTiming(ctx: ServerTimingContext): string {
  const now = performance.now();
  const entries: string[] = [];
  for (const name of ["kv", "db", "cache"] as const) {
    const metric = ctx[name];
    if (metric) {
      const desc = metric.label?.(metric);
      const busy = metric.busy + (metric.inflight > 0 ? now - metric.since : 0);
      entries.push(`${name}${desc ? `;desc="${desc}"` : ""};dur=${round(busy)}`);
    }
  }
  if (ctx.options.total) {
    entries.push(`total;dur=${round(now - ctx.start)}`);
  }
  return entries.join(", ");
}

export function useALS(): AsyncLocalStorage<ServerTimingContext> | undefined {
  if (_als === undefined) {
    const AsyncLocalStorage =
      globalThis.process?.getBuiltinModule?.("node:async_hooks")?.AsyncLocalStorage;
    _als = AsyncLocalStorage ? new AsyncLocalStorage<ServerTimingContext>() : null;
  }
  return _als || undefined;
}

function appendServerTiming(event: H3Event, value: unknown, isError: boolean): unknown {
  if (typeof (value as Promise<unknown>)?.then === "function") {
    return (value as Promise<unknown>).then((v) => appendServerTiming(event, v, isError));
  }
  // Errors and 404s are rendered by the error handler.
  if (!isError && (value === kNotFound || value instanceof Error || typeof value === "symbol")) {
    return value;
  }
  const ctx = (event.context as Record<symbol, unknown>)[kServerTiming] as
    | ServerTimingContext
    | undefined;
  let timing = ctx && formatServerTiming(ctx);
  if (!timing) {
    return value;
  }
  if (isError && value instanceof Response) {
    try {
      value.headers.append("server-timing", timing);
    } catch {
      // Immutable headers (e.g. `Response.redirect()`)
      value = new Response(value.body, value);
      (value as Response).headers.append("server-timing", timing);
    }
    return value;
  }
  // h3 merges staged headers into a returned response with `set`, so keep its own entries.
  const headers = (value as { headers?: unknown } | null | undefined)?.headers;
  const upstream = !isError && headers instanceof Headers && headers.get("server-timing");
  if (upstream) {
    timing = `${upstream}, ${timing}`;
  }
  const useErrHeaders = isError
    ? value === undefined || value === null
    : value instanceof Response && value.status >= 400;
  (useErrHeaders ? event.res.errHeaders : event.res.headers).append("server-timing", timing);
  return value;
}

function round(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}
