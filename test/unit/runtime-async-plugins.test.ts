import { describe, expect, it } from "vitest";
import { H3Core } from "h3";
import type { NitroApp } from "nitro/types";
import { afterNitroReady, initAsyncPlugins } from "../../src/runtime/internal/async-plugins.ts";

describe("runtime: async plugins", () => {
  it("holds requests until all plugins resolve, then restores onRequest", async () => {
    const order: string[] = [];
    const onRequest = () => {
      order.push("onRequest");
    };
    const app = createApp({ onRequest });
    const pending = createDeferred();

    initAsyncPlugins(app, pending.promise, [
      (app) => {
        order.push("plugin:sync");
        app.h3!["~middleware"].push((event, next) => {
          event.res.headers.set("x-plugin", "1");
          return next();
        });
      },
      async () => {
        await Promise.resolve();
        order.push("plugin:async");
      },
    ]);
    expect(app.ready).toBeInstanceOf(Promise);

    const res = app.fetch(new Request("http://localhost/"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(order).toEqual([]);

    pending.resolve();
    expect((await res).headers.get("x-plugin")).toBe("1");
    expect(order).toEqual(["plugin:sync", "plugin:async", "onRequest"]);
    expect(app.ready).toBeUndefined();
    expect(app.h3!.config.onRequest).toBe(onRequest);
  });

  it("keeps a plugin that wraps onRequest during init working once ready", async () => {
    const order: string[] = [];
    const app = createApp({ onRequest: () => void order.push("onRequest") });
    const pending = createDeferred();

    initAsyncPlugins(app, pending.promise, [
      (app) => {
        const original = app.h3!.config.onRequest!;
        app.h3!.config.onRequest = (event) => {
          order.push("wrapper");
          return original(event);
        };
      },
    ]);
    pending.resolve();
    await app.ready;

    const res = await app.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    expect(order).toEqual(["wrapper", "onRequest"]);
  });

  it("fails held requests and captures the error when a plugin rejects", async () => {
    const captured: unknown[] = [];
    const app = createApp({});
    app.captureError = (error) => captured.push(error);
    const error = new Error("init failed");

    const unhandled = await trackUnhandledRejections(async () => {
      initAsyncPlugins(app, Promise.reject(error), []);
      const ready = app.ready!;
      const res = await app.fetch(new Request("http://localhost/"));

      expect(res.status).toBe(500);
      await expect(ready).rejects.toBe(error);
      expect(captured).toContain(error);
    });
    expect(unhandled).toEqual([error]);
  });

  it("reports a rejected plugin once as an unhandled rejection", async () => {
    const app = createApp({});
    const error = new Error("init failed");

    const unhandled = await trackUnhandledRejections(async () => {
      initAsyncPlugins(app, Promise.reject(error), []);
    });
    expect(unhandled).toEqual([error]);
  });

  it("afterNitroReady() defers until ready", async () => {
    const app = createApp({});
    expect(afterNitroReady(app, () => 1)).toBe(1);

    const pending = createDeferred();
    initAsyncPlugins(app, pending.promise, []);
    const result = afterNitroReady(app, () => 2);
    expect(result).toBeInstanceOf(Promise);
    pending.resolve();
    expect(await result).toBe(2);
  });
});

function createApp(config: H3Core["config"]): NitroApp {
  const h3 = new H3Core(config);
  h3["~findRoute"] = () => ({ data: { handler: () => "ok" } }) as any;
  return { h3, fetch: (req) => h3.fetch(req) };
}

async function trackUnhandledRejections(fn: () => Promise<void>): Promise<unknown[]> {
  const reasons: unknown[] = [];
  const listeners = process.listeners("unhandledRejection");
  const listener = (reason: unknown) => reasons.push(reason);
  process.removeAllListeners("unhandledRejection");
  process.on("unhandledRejection", listener);
  try {
    await fn();
    await new Promise((resolve) => setTimeout(resolve, 10));
  } finally {
    process.off("unhandledRejection", listener);
    for (const l of listeners) {
      process.on("unhandledRejection", l);
    }
  }
  return reasons;
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}
