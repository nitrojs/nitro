import { readdir, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Nitro, NitroConfig } from "nitro/types";
import type { InlineConfig } from "vite";
import { join } from "pathe";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const { createBuilder } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./vite-base-fixture", import.meta.url));

async function createFixtureBuilder(viteConfig: InlineConfig, nitroConfig: NitroConfig = {}) {
  let nitro: Nitro | undefined;
  const outDir = join(rootDir, ".output", String(viteConfig.base ?? "default"));
  const originalCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const builder = await createBuilder({
      root: rootDir,
      logLevel: "warn",
      ...viteConfig,
      nitro: { preset: "standard", serveStatic: true, ...nitroConfig, output: { dir: outDir } },
      plugins: [
        {
          name: "capture-nitro",
          nitro: {
            setup(_nitro) {
              nitro ??= _nitro;
            },
          },
        },
      ],
    });
    return { builder, nitro: nitro!, outDir };
  } finally {
    process.chdir(originalCwd);
  }
}

// https://github.com/nitrojs/nitro/issues/5021
describe("vite: `base` as Nitro `baseURL` (build)", () => {
  let entryFetch: (req: Request) => Promise<Response>;
  let builtAsset: string;
  let nitro: Nitro;

  beforeAll(async () => {
    const result = await createFixtureBuilder({ base: "/app/" });
    nitro = result.nitro;
    const originalCwd = process.cwd();
    process.chdir(rootDir);
    try {
      await rm(result.outDir, { recursive: true, force: true });
      await result.builder.buildApp();
    } finally {
      process.chdir(originalCwd);
    }
    expect(nitro.options.output.publicDir).toBe(join(result.outDir, "public/app/"));
    builtAsset = (await readdir(join(nitro.options.output.publicDir, "assets"))).find((f) =>
      f.endsWith(".js")
    )!;
    const { default: entry } = await import(
      pathToFileURL(join(result.outDir, "server/index.mjs")).href
    );
    entryFetch = entry.fetch;
  }, 60_000);

  it("uses the Vite `base` as `baseURL`", () => {
    expect(nitro.options.baseURL).toBe("/app/");
    expect(nitro.options.runtimeConfig.app.baseURL).toBe("/app/");
  });

  it("serves client assets under the base", async () => {
    const res = await entryFetch(new Request(`http://localhost/app/assets/${builtAsset}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
  });

  it("renders routes under the base", async () => {
    const res = await entryFetch(new Request("http://localhost/app/about"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<h1>renderer</h1>");
  });

  it("renders client scripts that load under the base", async () => {
    const html = await (await entryFetch(new Request("http://localhost/app/"))).text();
    const scripts = [...html.matchAll(/<script[^>]* src="([^"]+)"/g)].map((m) => m[1]!);
    expect(scripts).toEqual([`/app/assets/${builtAsset}`]);
    for (const src of scripts) {
      expect((await entryFetch(new Request(`http://localhost${src}`))).status).toBe(200);
    }
  });
});

describe("vite: `base` and Nitro `baseURL` sync (config)", () => {
  let nitro: Nitro | undefined;

  afterEach(async () => {
    await nitro?.close();
    nitro = undefined;
  });

  it("uses Nitro `baseURL` as the Vite `base`", async () => {
    const result = await createFixtureBuilder({}, { baseURL: "/app/" });
    nitro = result.nitro;
    expect(result.builder.config.base).toBe("/app/");
    expect(nitro.options.baseURL).toBe("/app/");
  });

  it("keeps an explicit Nitro `baseURL`", async () => {
    const result = await createFixtureBuilder({ base: "/app/" }, { baseURL: "/" });
    nitro = result.nitro;
    expect(result.builder.config.base).toBe("/app/");
    expect(nitro.options.baseURL).toBe("/");
  });

  it.each(["./", "", "https://cdn.example.com/app/"])(
    "ignores a non-path Vite `base` (%j)",
    async (base) => {
      const result = await createFixtureBuilder({ base });
      nitro = result.nitro;
      expect(nitro.options.baseURL).toBe("/");
    }
  );
});
