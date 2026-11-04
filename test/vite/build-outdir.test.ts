import { fileURLToPath } from "node:url";
import { join, resolve } from "pathe";
import type { InlineConfig, Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { nitro } from "../../src/vite.ts";

const { createBuilder } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./build-outdir-fixture", import.meta.url));

// Like plugins that key their state on the root `build.outDir` (e.g. UnoCSS), then look up the
// directory a build writes to.
function outDirSpy() {
  const seen = { rootOutDir: "", clientOutDir: "", workerOutDir: "", clientOutDirKnown: false };
  const known = new Set<string>();
  const plugin: Plugin = {
    name: "test:out-dir-spy",
    configResolved(config) {
      seen.rootOutDir = config.build.outDir;
      seen.clientOutDir = config.environments.client.build.outDir;
      seen.workerOutDir = config.environments.worker.build.outDir;
      known.add(resolve(config.root, config.build.outDir));
    },
    generateBundle(options) {
      if (this.environment.name === "client") {
        seen.clientOutDirKnown = known.has(resolve(options.dir!));
      }
    },
  };
  return { plugin, seen };
}

async function build(name: string, viteConfig: InlineConfig = {}) {
  const { plugin, seen } = outDirSpy();
  const cwd = process.cwd();
  process.chdir(rootDir);
  try {
    const builder = await createBuilder({
      root: rootDir,
      configFile: false,
      logLevel: "warn",
      environments: {
        client: { build: { rollupOptions: { input: "./entry-client.ts" } } },
        ssr: { build: { rollupOptions: { input: "./entry-server.ts" } } },
        worker: { consumer: "server" },
      },
      ...viteConfig,
      // The spy comes first, as it reads the config before Nitro does
      plugins: [
        plugin,
        nitro({ preset: "standard", output: { dir: join(rootDir, ".output", name) } }),
      ],
    });
    await builder.buildApp();
  } finally {
    process.chdir(cwd);
  }
  return seen;
}

// https://github.com/nitrojs/nitro/issues/3596
describe("vite: root `build.outDir`", () => {
  it("defaults to where the client build is written", async () => {
    const seen = await build("default");
    expect(seen.rootOutDir).toBe(seen.clientOutDir);
    expect(seen.rootOutDir).toMatch(/\.output\/default\/public\/?$/);
    expect(seen.clientOutDirKnown).toBe(true);
  }, 60_000);

  it("keeps the one set by the user", async () => {
    const seen = await build("custom", { build: { outDir: "custom-dist" } });
    expect(seen.rootOutDir).toBe("custom-dist");
    expect(seen.clientOutDir).toMatch(/\.output\/custom\/public\/?$/);
  }, 60_000);

  // Environments inherit the root value: a server environment must not write to the public dir
  it("is not inherited by other environments", async () => {
    const seen = await build("inherit");
    expect(seen.workerOutDir).toBe("dist");
  }, 60_000);
});
