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
}

export interface ServerTimingContext {
  options: ServerTimingOptions;
  start: number;
  /** Set once the header is built: later operations (background work) are not recorded. */
  done?: boolean;
  kv?: ServerTimingMetric;
  db?: ServerTimingMetric;
  cache?: ServerTimingMetric;
}

/**
 * Process-wide, like the diagnostics channel subscriptions it tracks, so a runtime that is
 * re-evaluated in the same process (Vite dev reloads) reuses them instead of subscribing again.
 */
export interface ServerTimingState {
  /** Context of the request the current async execution belongs to. */
  getStore?: () => ServerTimingContext | undefined;
  als?: AsyncLocalStorage<ServerTimingContext> | null;
  traced: Set<string>;
}

export interface ServerTimingContextOptions {
  metrics: ServerTimingOptions;
  /** Current request from an existing async context (`experimental.asyncContext`), to avoid running another one. */
  getRequest?: () => ServerRequest | undefined;
}

const kServerTiming = /* @__PURE__ */ Symbol.for("nitro.serverTiming");
const kState = /* @__PURE__ */ Symbol.for("nitro.serverTiming.state");

export function withServerTimingContext(
  handler: (req: ServerRequest) => Response | Promise<Response>,
  { metrics, getRequest }: ServerTimingContextOptions
): (req: ServerRequest) => Response | Promise<Response> {
  let als: AsyncLocalStorage<ServerTimingContext> | undefined;
  if (metrics.kv || metrics.db) {
    const state = useServerTimingState();
    if (getRequest) {
      state.getStore = () => {
        const context = getRequest()?.context as Record<symbol, unknown> | undefined;
        return context?.[kServerTiming] as ServerTimingContext | undefined;
      };
    } else if ((als = useALS())) {
      const store = als;
      state.getStore = () => store.getStore();
    }
  }
  return (req) => {
    const ctx: ServerTimingContext = { options: metrics, start: performance.now() };
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

export function getServerTimingContext(event?: H3Event): ServerTimingContext | undefined {
  return (event && getEventContext(event)) ?? useServerTimingState().getStore?.();
}

export function beginOp(
  ctx: ServerTimingContext | undefined,
  name: MetricName
): ServerTimingMetric | undefined {
  if (!ctx?.options[name] || ctx.done) {
    return;
  }
  const metric = (ctx[name] ??= { count: 0, inflight: 0, since: 0, busy: 0 });
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
      const desc = describe(name, metric);
      const busy = metric.busy + (metric.inflight > 0 ? now - metric.since : 0);
      entries.push(`${name}${desc ? `;desc="${desc}"` : ""};dur=${round(busy)}`);
    }
  }
  if (ctx.options.total) {
    entries.push(`total;dur=${round(now - ctx.start)}`);
  }
  return entries.join(", ");
}

export function useServerTimingState(): ServerTimingState {
  return ((globalThis as Record<symbol, unknown>)[kState] ??= {
    traced: new Set(),
  }) as ServerTimingState;
}

export function useALS(): AsyncLocalStorage<ServerTimingContext> | undefined {
  const state = useServerTimingState();
  if (state.als === undefined) {
    const AsyncLocalStorage =
      globalThis.process?.getBuiltinModule?.("node:async_hooks")?.AsyncLocalStorage;
    state.als = AsyncLocalStorage ? new AsyncLocalStorage<ServerTimingContext>() : null;
  }
  return state.als || undefined;
}

function appendServerTiming(event: H3Event, value: unknown, isError: boolean): unknown {
  if (typeof (value as Promise<unknown>)?.then === "function") {
    return (value as Promise<unknown>).then((v) => appendServerTiming(event, v, isError));
  }
  // Errors and 404s (`kNotFound` symbol) are rendered by the error handler.
  if (!isError && (value instanceof Error || typeof value === "symbol")) {
    return value;
  }
  const ctx = getEventContext(event);
  if (!ctx) {
    return value;
  }
  let timing = formatServerTiming(ctx);
  ctx.done = true;
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

const units = { kv: ["op", "ops"], db: ["query", "queries"] } as const;

/** `kv` / `db`: number of operations, `cache`: status of each cached handler. */
function describe(name: MetricName, metric: ServerTimingMetric): string | undefined {
  if (name !== "cache") {
    return `${metric.count} ${units[name][metric.count === 1 ? 0 : 1]}`;
  }
  const entries = metric.status ? Object.entries(metric.status) : [];
  if (entries.length === 1 && entries[0][1] === 1) {
    return entries[0][0];
  }
  return entries.map(([status, count]) => `${count} ${status}`).join(", ") || undefined;
}

function getEventContext(event: H3Event): ServerTimingContext | undefined {
  return (event.context as Record<symbol, unknown>)[kServerTiming] as
    | ServerTimingContext
    | undefined;
}

function round(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}
