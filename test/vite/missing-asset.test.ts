import { readdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Nitro, NitroConfig } from "nitro/types";
import { join } from "pathe";
import { beforeAll, describe, expect, it } from "vitest";

const { createBuilder } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./missing-asset-fixture", import.meta.url));

async function buildFixture(name: string, config: NitroConfig) {
  const outDir = join(rootDir, ".output", name);
  await rm(outDir, { recursive: true, force: true });
  let nitro: Nitro | undefined;
  const warnings: string[] = [];
  const originalCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const builder = await createBuilder({
      root: rootDir,
      logLevel: "warn",
      nitro: { ...config, output: { dir: outDir } },
      plugins: [
        {
          name: "capture-nitro",
          nitro: {
            setup(_nitro) {
              // Also runs for the prerenderer instance
              if (!nitro) {
                nitro = _nitro;
                const warn = _nitro.logger.warn;
                _nitro.logger.warn = Object.assign(
                  (...args: Parameters<typeof warn>) => {
                    warnings.push(args.join(" "));
                    warn(...args);
                  },
                  { raw: warn.raw }
                );
              }
            },
          },
        },
      ],
    });
    await builder.buildApp();
  } finally {
    process.chdir(originalCwd);
  }
  return { outDir, nitro: nitro!, warnings };
}

describe.each([false, true])("vite: missing client assets (serveStatic=%s)", (serveStatic) => {
  let entryFetch: (req: Request) => Promise<Response>;
  let builtAsset: string;
  let nitro: Nitro;
  let warnings: string[];

  beforeAll(async () => {
    const result = await buildFixture(String(serveStatic), {
      preset: "standard",
      serveStatic,
      prerender: { routes: ["/assets/info"] },
    });
    ({ nitro, warnings } = result);
    builtAsset = (await readdir(join(result.outDir, "public/assets"))).find((f) =>
      f.endsWith(".js")
    )!;
    const { default: entry } = await import(
      pathToFileURL(join(result.outDir, "server/index.mjs")).href
    );
    entryFetch = entry.fetch;
  }, 60_000);

  it("renders other routes", async () => {
    const res = await entryFetch(new Request("http://localhost/about"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<h1>renderer</h1>");
  });

  it.runIf(serveStatic)("serves built assets as immutable", async () => {
    const res = await entryFetch(new Request(`http://localhost/assets/${builtAsset}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("responds with an uncached 404 for missing assets", async () => {
    const res = await entryFetch(new Request("http://localhost/assets/missing.js"));
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).not.toContain("<h1>renderer</h1>");
  });

  it("registers the assets dir once, without fallthrough", () => {
    expect(nitro.options.publicAssets.filter((a) => a.baseURL === "/assets")).toMatchObject([
      { baseURL: "/assets", fallthrough: false, maxAge: 31_536_000 },
    ]);
  });

  it("warns about listed prerender routes under the assets dir", () => {
    expect(warnings).toContainEqual(
      expect.stringContaining("Skipping prerender of `/assets/info`")
    );
  });
});

describe("vite: missing client assets (vercel, custom cache-control)", () => {
  let config: { routes: Record<string, any>[] };
  let nitro: Nitro;

  beforeAll(async () => {
    const result = await buildFixture("vercel", {
      preset: "vercel",
      routeRules: { "/assets/**": { headers: { "cache-control": "public, max-age=60" } } },
    });
    nitro = result.nitro;
    config = JSON.parse(await readFile(join(result.outDir, "config.json"), "utf8"));
  }, 60_000);

  it("keeps the user `cache-control`", () => {
    expect(nitro.options.publicAssets.filter((a) => a.baseURL === "/assets")).toMatchObject([
      { fallthrough: false, maxAge: 0 },
    ]);
    const headers = config.routes.flatMap((r) => (r.headers ? [r.headers["cache-control"]] : []));
    expect(headers).toContain("public, max-age=60");
    expect(headers.some((h) => h?.includes("immutable"))).toBe(false);
  });

  it("responds with an uncached 404 for missing assets", () => {
    const filesystem = config.routes.findIndex((r) => r.handle === "filesystem");
    const missing = config.routes.findIndex((r) => r.src === "/assets/(.*)");
    expect(missing).toBeGreaterThan(filesystem);
    expect(config.routes[missing]).toEqual({
      src: "/assets/(.*)",
      status: 404,
      headers: { "cache-control": "no-store" },
      continue: false,
    });
  });
});
