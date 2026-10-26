import { existsSync, promises as fsp } from "node:fs";
import { OutputRootConfigSchema, OutputWorkerSchema } from "@cloudflare/config";
import { Miniflare } from "miniflare";
import { relative, resolve } from "pathe";
import { describe, expect, it } from "vitest";

import { getPresetTmpDir, setupTest, testNitro } from "../tests.ts";

const outputDir = resolve(getPresetTmpDir("cloudflare"), ".cloudflare/output/v0");
const workerDir = resolve(outputDir, "workers/default");

describe("nitro:preset:cloudflare", async () => {
  const ctx = await setupTest("cloudflare", {
    config: { output: { dir: outputDir } },
  });

  const readJSON = (path: string) => fsp.readFile(path, "utf8").then((r) => JSON.parse(r));

  testNitro(ctx, async () => {
    const mf = new Miniflare({
      ...(await miniflareModules()),
      compatibilityDate: "2025-04-01",
      assets: {
        directory: resolve(workerDir, "assets"),
        binding: "ASSETS",
        routerConfig: { has_user_worker: true },
      },
      compatibilityFlags: ["nodejs_compat", "no_nodejs_compat_v2"],
      bindings: { ...ctx.env },
    });

    return async ({ url, headers, method, body }) => {
      const res = await mf.dispatchFetch("http://localhost" + url, {
        headers: headers || {},
        method: method || "GET",
        redirect: "manual",
        body,
      });
      return res as unknown as Response;
    };
  });

  it("writes a valid root config", async () => {
    const rootConfig = OutputRootConfigSchema.parse(
      await readJSON(resolve(outputDir, "config.json"))
    );
    expect(rootConfig).toEqual({ buildContext: { isPreview: false } });
  });

  it("writes a valid Worker config with Nitro defaults", async () => {
    const config = OutputWorkerSchema.parse(
      await readJSON(resolve(workerDir, "worker.config.json"))
    );
    expect(config.name).toBeTypeOf("string");
    expect(config.compatibilityDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(config.env).toEqual({ ASSETS: { type: "assets" } });
    expect(config.triggers).toEqual([{ type: "scheduled", schedule: "* * * * *" }]);
  });

  it("lists every bundle module in a complete manifest", async () => {
    const { manifest } = OutputWorkerSchema.parse(
      await readJSON(resolve(workerDir, "worker.config.json"))
    );
    expect(manifest).toMatchObject({ type: "complete", mainModule: "index.mjs" });
    expect(manifest!.modules["index.mjs"]).toEqual({ type: "esm" });
    const wasmModules = Object.entries(manifest!.modules).filter(([, m]) => m.type === "wasm");
    expect(wasmModules.length).toBeGreaterThan(0);
    const bundleFiles = await fsp.readdir(resolve(workerDir, "bundle"), {
      recursive: true,
      withFileTypes: true,
    });
    const files = bundleFiles
      .filter((entry) => entry.isFile())
      .map((entry) => relative(resolve(workerDir, "bundle"), resolve(entry.parentPath, entry.name)))
      .sort();
    expect(Object.keys(manifest!.modules).sort()).toEqual(files);
  });

  it("removes the public assets compressed before the build", async () => {
    const assets = await fsp.readdir(resolve(workerDir, "assets"), { recursive: true });
    expect(assets.filter((file) => /\.(gz|br|zst)$/.test(file))).toEqual([]);
    const bundle = await fsp.readdir(resolve(workerDir, "bundle"), { recursive: true });
    const code = await Promise.all(
      bundle
        .filter((file) => file.endsWith(".mjs"))
        .map((file) => fsp.readFile(resolve(workerDir, "bundle", file), "utf8"))
    );
    expect(code.join("\n")).not.toMatch(/\.(gz|br|zst)"/);
  });

  it("only writes the Build Output layout", async () => {
    expect(existsSync(resolve(workerDir, "bundle/wrangler.json"))).toBe(false);
    expect(existsSync(resolve(outputDir, "package.json"))).toBe(false);
    const entries = await fsp.readdir(outputDir, { recursive: true, withFileTypes: true });
    expect(entries.filter((entry) => entry.isSymbolicLink())).toEqual([]);
  });
});

// Run the Worker with the manifest modules only, as `cf deploy` uploads them
async function miniflareModules() {
  const bundleDir = resolve(workerDir, "bundle");
  const { manifest } = JSON.parse(
    await fsp.readFile(resolve(workerDir, "worker.config.json"), "utf8")
  );
  const types: Record<string, "ESModule" | "CompiledWasm"> = {
    esm: "ESModule",
    wasm: "CompiledWasm",
  };
  const paths = Object.entries<{ type: string }>(manifest.modules)
    .filter(([, { type }]) => type !== "sourcemap")
    .map(([path, { type }]) => ({ type: types[type], path: resolve(bundleDir, path) }));
  const main = resolve(bundleDir, manifest.mainModule);
  return {
    modulesRoot: bundleDir,
    modules: paths.sort((a, b) => Number(b.path === main) - Number(a.path === main)),
  };
}
