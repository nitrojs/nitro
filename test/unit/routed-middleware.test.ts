import { afterAll, describe, expect, it } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";
import { join } from "pathe";
import { fileURLToPath } from "node:url";
import { rm, mkdir } from "node:fs/promises";

const tmpDir = fileURLToPath(new URL("./.tmp/routed-middleware", import.meta.url));

describe("route-scoped middleware", () => {
  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("executes route-scoped middleware without throwing fn is not a function", async () => {
    const outDir = join(tmpDir, "output");
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });

    const nitro = await createNitro({
      rootDir: tmpDir,
      preset: "standard",
      output: { dir: outDir },
      virtual: {
        "#auth-middleware": () =>
          `export default (event) => { event.res.headers.set("x-auth-middleware", "true"); }`,
        "#hello-handler": () => `export default () => ({ message: "hello" })`,
        "#other-handler": () => `export default () => ({ message: "other" })`,
      },
      handlers: [
        {
          route: "/api/**",
          handler: "#auth-middleware",
          middleware: true,
        },
        {
          route: "/api/hello",
          handler: "#hello-handler",
        },
        {
          route: "/other",
          handler: "#other-handler",
        },
      ],
    });

    await prepare(nitro);
    await build(nitro);

    const entry = join(outDir, "server/index.mjs");
    const { fetch } = await import(entry).then((m) => m.default);

    // Request matching routed middleware
    const res = await fetch(new Request("http://localhost/api/hello"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-auth-middleware")).toBe("true");
    expect(await res.json()).toEqual({ message: "hello" });

    // Request not matching routed middleware
    const resOther = await fetch(new Request("http://localhost/other"));
    expect(resOther.status).toBe(200);
    expect(resOther.headers.get("x-auth-middleware")).toBeNull();
    expect(await resOther.json()).toEqual({ message: "other" });
  });

  it("executes middleware in route-rules -> global -> routed middleware order", async () => {
    const outDir = join(tmpDir, "output-ordering");
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });

    const nitro = await createNitro({
      rootDir: tmpDir,
      preset: "standard",
      output: { dir: outDir },
      routeRules: {
        "/api/**": {
          headers: { "x-route-rule": "applied" },
        },
      },
      virtual: {
        "#global-middleware": () =>
          `export default (event) => {
            const current = event.res.headers.get("x-execution-order") || "";
            event.res.headers.set("x-execution-order", current ? current + ", global" : "global");
          }`,
        "#routed-middleware": () =>
          `export default (event) => {
            const current = event.res.headers.get("x-execution-order") || "";
            event.res.headers.set("x-execution-order", current + ", routed");
          }`,
        "#order-handler": () => `export default (event) => ({
          status: "ok",
          order: event.res.headers.get("x-execution-order"),
          hasContextRouteRules: !!event.context?.routeRules,
        })`,
      },
      handlers: [
        {
          handler: "#global-middleware",
          middleware: true,
        },
        {
          route: "/api/**",
          handler: "#routed-middleware",
          middleware: true,
        },
        {
          route: "/api/order",
          handler: "#order-handler",
        },
      ],
    });

    await prepare(nitro);
    await build(nitro);

    const entry = join(outDir, "server/index.mjs");
    const { fetch } = await import(entry).then((m) => m.default);

    const res = await fetch(new Request("http://localhost/api/order"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-execution-order")).toBe("global, routed");
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.order).toBe("global, routed");
    expect(data.hasContextRouteRules).toBe(true);
  });
});
