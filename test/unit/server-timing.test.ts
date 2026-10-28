import { AsyncLocalStorage } from "node:async_hooks";
import { tracingChannel } from "node:diagnostics_channel";
import { afterEach, describe, expect, it, vi } from "vitest";
import { H3, HTTPError } from "h3";
import { FastResponse } from "srvx";
import type { ServerRequest } from "srvx";
import {
  beginOp,
  endOp,
  formatServerTiming,
  getServerTimingContext,
  withServerTimingContext,
} from "../../src/runtime/internal/server-timing.ts";
import type { ServerTimingContext } from "../../src/runtime/internal/server-timing.ts";

const options = { total: true, kv: true, db: true, cache: true };

const TOTAL = "total;dur=[\\d.]+";

function createApp(opts: { errorHandler?: (error: HTTPError) => unknown } = {}) {
  const errorHandler =
    opts.errorHandler ??
    ((error: HTTPError) =>
      new FastResponse(JSON.stringify({ status: error.status }), {
        status: error.status,
        headers: { "content-type": "application/json" },
      }));
  const app = new H3({ onError: (error) => errorHandler(error) as any });
  const fetch = withServerTimingContext((req) => app.fetch(req), { metrics: options });
  return {
    app,
    request: async (path: string) =>
      (await fetch(new Request(`http://localhost${path}`) as ServerRequest)).headers.get(
        "server-timing"
      ),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runtime: server timing", () => {
  it("adds total to plain values and responses", async () => {
    const { app, request } = createApp();
    app.get("/value", () => "ok");
    app.get("/response", () => new Response("ok"));
    app.get("/redirect", () => Response.redirect("http://localhost/value", 302));
    expect(await request("/value")).toMatch(new RegExp(`^${TOTAL}$`));
    expect(await request("/response")).toMatch(new RegExp(`^${TOTAL}$`));
    expect(await request("/redirect")).toMatch(new RegExp(`^${TOTAL}$`));
  });

  it("adds total to error responses", async () => {
    const { app, request } = createApp();
    app.get("/returned", () => new Response("bad", { status: 400 }));
    app.get("/thrown", () => {
      throw new HTTPError({ status: 503 });
    });
    app.get("/unhandled", () => {
      throw new Error("boom");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await request("/returned")).toMatch(new RegExp(`^${TOTAL}$`));
    expect(await request("/thrown")).toMatch(new RegExp(`^${TOTAL}$`));
    expect(await request("/unhandled")).toMatch(new RegExp(`^${TOTAL}$`));
    expect(await request("/not-found")).toMatch(new RegExp(`^${TOTAL}$`));
  });

  it("adds total when the error handler returns nothing", async () => {
    const { app, request } = createApp({ errorHandler: () => undefined });
    app.get("/thrown", () => {
      throw new HTTPError({ status: 503 });
    });
    expect(await request("/thrown")).toMatch(new RegExp(`^${TOTAL}$`));
  });

  it("keeps entries already on a returned response", async () => {
    const { app, request } = createApp();
    app.get("/", () => new Response("ok", { headers: { "server-timing": "app;dur=5" } }));
    expect(await request("/")).toMatch(new RegExp(`^app;dur=5, ${TOTAL}$`));
  });

  it("isolates concurrent requests", async () => {
    const { app, request } = createApp();
    app.get("/ops/:count", async (event) => {
      const count = Number(event.context.params!.count);
      for (let i = 0; i < count; i++) {
        const metric = beginOp(getServerTimingContext(), "kv");
        await new Promise((resolve) => setTimeout(resolve, 5));
        endOp(metric);
      }
      return "ok";
    });
    const [one, three] = await Promise.all([request("/ops/1"), request("/ops/3")]);
    expect(one).toMatch(new RegExp(`^kv;desc="1 op";dur=[\\d.]+, ${TOTAL}$`));
    expect(three).toMatch(new RegExp(`^kv;desc="3 ops";dur=[\\d.]+, ${TOTAL}$`));
  });

  it("records traced channel operations", async () => {
    const channel = tracingChannel("db0.query");
    const { app, request } = createApp();
    app.get("/", async () => {
      await Promise.all([
        channel.tracePromise(async () => {}, {}),
        channel.tracePromise(async () => {}, {}),
      ]);
      return "ok";
    });
    expect(await request("/")).toMatch(new RegExp(`^db;desc="2 queries";dur=[\\d.]+, ${TOTAL}$`));
  });
});

describe("runtime: server timing async context", () => {
  it("reuses an existing async context", async () => {
    const channel = tracingChannel("unstorage.getItem");
    const requests = new AsyncLocalStorage<ServerRequest>();
    const app = new H3();
    app.get("/", async () => {
      await channel.tracePromise(async () => {}, {});
      return "ok";
    });
    const fetch = withServerTimingContext((req) => app.fetch(req), {
      metrics: options,
      getRequest: () => requests.getStore(),
    });
    const run = vi.spyOn(AsyncLocalStorage.prototype, "run");
    const req = new Request("http://localhost/") as ServerRequest;
    const res = await requests.run(req, () => fetch(req));
    expect(run).toHaveBeenCalledTimes(1);
    expect(res.headers.get("server-timing")).toMatch(
      new RegExp(`^kv;desc="1 op";dur=[\\d.]+, ${TOTAL}$`)
    );
  });

  it("does not record operations once the header is built", async () => {
    const { app, request } = createApp();
    let ctx: ServerTimingContext | undefined;
    app.get("/", (event) => {
      ctx = getServerTimingContext(event);
      return "ok";
    });
    await request("/");
    expect(ctx).toBeDefined();
    expect(beginOp(ctx, "kv")).toBeUndefined();
  });
});

describe("runtime: server timing busy time", () => {
  function mockClock() {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    return (to: number) => {
      now = to;
    };
  }

  it("counts parallel operations once", () => {
    const setNow = mockClock();
    const ctx: ServerTimingContext = { options, start: 0 };
    const a = beginOp(ctx, "db");
    const b = beginOp(ctx, "db");
    setNow(50);
    endOp(a);
    endOp(b);
    setNow(60);
    expect(formatServerTiming(ctx)).toBe(`db;desc="2 queries";dur=50, total;dur=60`);
  });

  it("adds sequential operations", () => {
    const setNow = mockClock();
    const ctx: ServerTimingContext = { options, start: 0 };
    const a = beginOp(ctx, "db");
    setNow(50);
    endOp(a);
    const b = beginOp(ctx, "db");
    setNow(100);
    endOp(b);
    expect(formatServerTiming(ctx)).toBe(`db;desc="2 queries";dur=100, total;dur=100`);
  });

  it("includes operations still in flight", () => {
    const setNow = mockClock();
    const ctx: ServerTimingContext = { options, start: 0 };
    beginOp(ctx, "kv");
    setNow(20);
    expect(formatServerTiming(ctx)).toBe(`kv;desc="1 op";dur=20, total;dur=20`);
  });

  it("summarizes cache statuses", () => {
    mockClock();
    const ctx: ServerTimingContext = { options, start: 0 };
    endOp(beginOp(ctx, "cache"), "hit");
    expect(formatServerTiming(ctx)).toBe(`cache;desc="hit";dur=0, total;dur=0`);
    endOp(beginOp(ctx, "cache"), "hit");
    endOp(beginOp(ctx, "cache"), "miss");
    expect(formatServerTiming(ctx)).toBe(`cache;desc="2 hit, 1 miss";dur=0, total;dur=0`);
  });

  it("skips disabled metrics", () => {
    mockClock();
    const ctx: ServerTimingContext = { options: { ...options, kv: false, total: false }, start: 0 };
    expect(beginOp(ctx, "kv")).toBeUndefined();
    expect(formatServerTiming(ctx)).toBe("");
  });
});

describe("runtime: server timing across runtime reloads", () => {
  it("replaces tracing channel subscriptions", async () => {
    const channel = tracingChannel("unstorage.getItem");
    const requests = new AsyncLocalStorage<ServerRequest>();
    let fetch!: (req: ServerRequest) => Response | Promise<Response>;
    for (let i = 0; i < 3; i++) {
      vi.resetModules();
      const timing = await import("../../src/runtime/internal/server-timing.ts");
      fetch = timing.withServerTimingContext(
        async () => {
          await channel.tracePromise(async () => {}, {});
          return new Response("ok");
        },
        { metrics: options, getRequest: () => requests.getStore() }
      );
    }
    const req = new Request("http://localhost/") as ServerRequest;
    const res = await requests.run(req, () => fetch(req));
    // Subscriptions left over from previous evaluations would count the operation again
    expect(res.headers.get("server-timing")).toMatch(
      new RegExp(`^kv;desc="1 op";dur=[\\d.]+, ${TOTAL}$`)
    );
  });
});

describe("runtime: server timing without async context", () => {
  it("still reports total and event-based metrics", async () => {
    vi.resetModules();
    vi.spyOn(process, "getBuiltinModule").mockReturnValue(undefined as any);
    const timing = await import("../../src/runtime/internal/server-timing.ts");
    const app = new H3();
    app.get("/", (event) => {
      expect(timing.getServerTimingContext()).toBeUndefined();
      timing.endOp(timing.beginOp(timing.getServerTimingContext(event), "cache"), "hit");
      return "ok";
    });
    const fetch = timing.withServerTimingContext((req) => app.fetch(req), { metrics: options });
    const res = await fetch(new Request("http://localhost/") as ServerRequest);
    expect(res.headers.get("server-timing")).toMatch(
      new RegExp(`^cache;desc="hit";dur=[\\d.]+, ${TOTAL}$`)
    );
  });
});
