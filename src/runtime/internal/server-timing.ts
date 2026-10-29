import type { H3Event } from "h3";
import type { ServerRequest } from "srvx";
import type { NitroOptions } from "nitro/types";
import type { AsyncLocalStorage } from "node:async_hooks";
import { subscribeTracingChannels } from "./telemetry/subscribe.ts";
import { UNSTORAGE_CHANNELS } from "./telemetry/unstorage.ts";

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

export interface ServerTimingContextOptions {
  metrics: ServerTimingOptions;
  /** Current request from an existing async context (`experimental.asyncContext`), to avoid running another one. */
  getRequest?: () => ServerRequest | undefined;
}

const kServerTiming = /* @__PURE__ */ Symbol.for("nitro.serverTiming");

/** Context of the request the current async execution belongs to. */
let getStore: (() => ServerTimingContext | undefined) | undefined;

/**
 * Wraps the Nitro app handler: measures the request and appends the `Server-Timing` header to
 * whatever response it produces (routes, errors, 404s, server entry).
 *
 * `kv` / `db` are recorded from the `unstorage.*` / `db0.query` tracing channels, which needs
 * async context to attribute operations to a request (`node:async_hooks`).
 */
export function withServerTimingContext(
  handler: (req: ServerRequest) => Response | Promise<Response>,
  { metrics, getRequest }: ServerTimingContextOptions
): (req: ServerRequest) => Response | Promise<Response> {
  let als: AsyncLocalStorage<ServerTimingContext> | undefined;
  getStore = undefined;
  if (metrics.kv || metrics.db) {
    if (getRequest) {
      getStore = () => getContext(getRequest()?.context);
    } else if ((als = createALS())) {
      getStore = als.getStore.bind(als);
    }
  }
  if (getStore) {
    if (metrics.kv) {
      traceServerTiming("kv", UNSTORAGE_CHANNELS);
    }
    if (metrics.db) {
      traceServerTiming("db", ["db0.query"]);
    }
  }
  return (req) => {
    const ctx: ServerTimingContext = { options: metrics, start: performance.now() };
    ((req.context ||= {}) as Record<symbol, unknown>)[kServerTiming] = ctx;
    const res = als ? als.run(ctx, handler, req) : handler(req);
    return res instanceof Promise
      ? res.then((res) => appendServerTiming(res, ctx))
      : appendServerTiming(res, ctx);
  };
}

export function getServerTimingContext(event?: H3Event): ServerTimingContext | undefined {
  return (event && getContext(event.context)) ?? getStore?.();
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

function traceServerTiming(name: "kv" | "db", channels: readonly string[]): void {
  subscribeTracingChannels(channels, {
    id: `nitro.serverTiming.${name}`,
    onStart: () => beginOp(getStore?.(), name),
    onEnd: (_, __, metric) => endOp(metric),
  });
}

function appendServerTiming(res: Response, ctx: ServerTimingContext): Response {
  const timing = formatServerTiming(ctx);
  ctx.done = true;
  if (!timing) {
    return res;
  }
  try {
    res.headers.append("server-timing", timing);
  } catch {
    // Immutable headers (e.g. `Response.redirect()` or a proxied `fetch()` response)
    res = new Response(res.body, res);
    res.headers.append("server-timing", timing);
  }
  return res;
}

function createALS(): AsyncLocalStorage<ServerTimingContext> | undefined {
  const AsyncLocalStorage =
    globalThis.process?.getBuiltinModule?.("node:async_hooks")?.AsyncLocalStorage;
  return AsyncLocalStorage ? new AsyncLocalStorage<ServerTimingContext>() : undefined;
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

function getContext(context: object | undefined): ServerTimingContext | undefined {
  return (context as Record<symbol, unknown> | undefined)?.[kServerTiming] as
    | ServerTimingContext
    | undefined;
}

function round(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}
