import { promises as fsp } from "node:fs";
import { tmpdir } from "node:os";
import type { Nitro } from "nitropack/types";
import { join, resolve } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateFunctionFiles } from "../../src/presets/vercel/utils";

// These tests exercise the build output directly via `generateFunctionFiles`
// with a minimal Nitro stub, avoiding a full (rollup) build via `setupTest`.
describe("vercel queues build output", () => {
  let outDir: string;
  let serverDir: string;

  // A default older compat date keeps observability routes disabled (so most
  // assertions don't need handlers/ssrRoutes); override via `options`.
  const createNitroStub = (
    vercel: unknown,
    options: Record<string, unknown> = {}
  ): Nitro =>
    ({
      options: {
        rootDir: outDir,
        baseURL: "/",
        static: false,
        routeRules: {},
        publicAssets: [],
        ssrRoutes: [],
        handlers: [],
        compatibilityDate: { default: "2025-01-01" },
        output: { dir: outDir, serverDir },
        vercel,
        ...options,
      },
      scannedHandlers: [],
      _prerenderedRoutes: [],
    }) as unknown as Nitro;

  // Fresh temp dir per test so generated `.func` directories can't leak
  // between assertions.
  beforeEach(async () => {
    outDir = await fsp.mkdtemp(join(tmpdir(), "nitro-vercel-queues-"));
    serverDir = resolve(outDir, "functions/__fallback.func");
    await fsp.mkdir(serverDir, { recursive: true });
    // The queue consumer is a copy of the fallback server bundle.
    await fsp.writeFile(
      resolve(serverDir, "index.mjs"),
      "export default {};\n"
    );
  });

  afterEach(async () => {
    await fsp.rm(outDir, { recursive: true, force: true });
  });

  it("creates a real consumer function dir with experimentalTriggers", async () => {
    await generateFunctionFiles(
      createNitroStub({
        queues: {
          triggers: [
            { topic: "orders", retryAfterSeconds: 60 },
            { topic: "notifications", initialDelaySeconds: 10 },
          ],
        },
      })
    );

    const funcDir = resolve(outDir, "functions/_vercel/queues/consumer.func");

    // Must be a real directory, not a symlink to the fallback function.
    const stat = await fsp.lstat(funcDir);
    expect(stat.isDirectory()).toBe(true);
    expect(stat.isSymbolicLink()).toBe(false);

    // The fallback bundle is copied into the consumer function.
    const index = await fsp.readFile(resolve(funcDir, "index.mjs"), "utf8");
    expect(index).toContain("export default");

    const config = await fsp
      .readFile(resolve(funcDir, ".vc-config.json"), "utf8")
      .then((r) => JSON.parse(r));
    expect(config.experimentalTriggers).toEqual([
      {
        type: "queue/v2beta",
        topic: "orders",
        retryAfterSeconds: 60,
        consumer: "__vercel_Squeues_Sconsumer",
      },
      {
        type: "queue/v2beta",
        topic: "notifications",
        initialDelaySeconds: 10,
        consumer: "__vercel_Squeues_Sconsumer",
      },
    ]);
    expect(config.handler).toBe("index.mjs");

    // The triggers must only live on the copied consumer function. If it were a
    // symlink to the fallback, this write would have mutated the shared config.
    const fallbackConfig = await fsp
      .readFile(resolve(serverDir, ".vc-config.json"), "utf8")
      .then((r) => JSON.parse(r));
    expect(fallbackConfig.experimentalTriggers).toBeUndefined();
  });

  it("adds the queue consumer route to config.json", async () => {
    await generateFunctionFiles(
      createNitroStub({ queues: { triggers: [{ topic: "orders" }] } })
    );

    const config = await fsp
      .readFile(resolve(outDir, "config.json"), "utf8")
      .then((r) => JSON.parse(r));
    const routes = config.routes as { src: string; dest: string }[];
    expect(
      routes.find(
        (r) =>
          r.src === "/_vercel/queues/consumer" &&
          r.dest === "/_vercel/queues/consumer"
      )
    ).toBeDefined();
  });

  it("honors a custom handlerRoute", async () => {
    await generateFunctionFiles(
      createNitroStub({
        queues: {
          handlerRoute: "/api/_queue",
          triggers: [{ topic: "orders" }],
        },
      })
    );

    const funcDir = resolve(outDir, "functions/api/_queue.func");
    const config = await fsp
      .readFile(resolve(funcDir, ".vc-config.json"), "utf8")
      .then((r) => JSON.parse(r));
    expect(config.experimentalTriggers[0].consumer).toBe("api_S__queue");

    const buildConfig = await fsp
      .readFile(resolve(outDir, "config.json"), "utf8")
      .then((r) => JSON.parse(r));
    const routes = buildConfig.routes as { src: string; dest: string }[];
    expect(
      routes.find((r) => r.src === "/api/_queue" && r.dest === "/api/_queue")
    ).toBeDefined();
  });

  it("throws (without deleting the bundle) if handlerRoute targets the server dir", async () => {
    await expect(
      generateFunctionFiles(
        createNitroStub({
          queues: { handlerRoute: "/__fallback", triggers: [{ topic: "x" }] },
        })
      )
    ).rejects.toThrow(/handlerRoute/);

    // The source bundle must remain intact.
    const index = await fsp.readFile(resolve(serverDir, "index.mjs"), "utf8");
    expect(index).toContain("export default");
  });

  it("does not create a consumer function without triggers", async () => {
    await generateFunctionFiles(createNitroStub({}));

    const buildConfig = await fsp
      .readFile(resolve(outDir, "config.json"), "utf8")
      .then((r) => JSON.parse(r));
    const routes = buildConfig.routes as { src?: string }[];
    expect(routes.some((r) => r.src?.includes("/_vercel/queues/"))).toBe(false);

    // No consumer function directory should be generated.
    const exists = await fsp
      .access(resolve(outDir, "functions/_vercel/queues/consumer.func"))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  // With a modern compat date, a catch-all (`/**`) handler produces an
  // observability route `/(?:.*)` that matches everything. The queue route must
  // be emitted before it (and only once) or queue callbacks get routed to the
  // fallback function, which lacks `experimentalTriggers`.
  it("emits the queue route before the observability catch-all (and only once)", async () => {
    await generateFunctionFiles(
      createNitroStub(
        { queues: { triggers: [{ topic: "orders" }] } },
        {
          compatibilityDate: { default: "2025-08-01" },
          ssrRoutes: ["/**"],
          // The preset registers the consumer as a real handler; it must be
          // excluded from observability so it isn't added/symlinked twice.
          handlers: [{ route: "/_vercel/queues/consumer" }],
        }
      )
    );

    const config = await fsp
      .readFile(resolve(outDir, "config.json"), "utf8")
      .then((r) => JSON.parse(r));
    const routes = config.routes as { src?: string; dest?: string }[];

    const queueIdxs = routes
      .map((r, i) => (r.dest === "/_vercel/queues/consumer" ? i : -1))
      .filter((i) => i !== -1);
    expect(queueIdxs).toHaveLength(1);

    const catchAllIdx = routes.findIndex((r) => r.src === "/(?:.*)");
    expect(catchAllIdx).toBeGreaterThan(-1);
    expect(queueIdxs[0]).toBeLessThan(catchAllIdx);
  });
});
