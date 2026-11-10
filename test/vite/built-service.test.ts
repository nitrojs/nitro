import { fileURLToPath, pathToFileURL } from "node:url";
import { rm } from "node:fs/promises";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import type { Plugin } from "vite";

const { createBuilder } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite: service environment marked as built", () => {
  const rootDir = fileURLToPath(new URL("./built-service-fixture", import.meta.url));

  const cleanup = () =>
    Promise.all(
      [".output", "node_modules"].map((dir) =>
        rm(join(rootDir, dir), { recursive: true, force: true })
      )
    );

  async function build(skipSsr: boolean) {
    const skipPlugin: Plugin = {
      name: "skip-ssr",
      buildApp: {
        order: "pre",
        async handler(builder) {
          builder.environments.ssr.isBuilt = skipSsr;
        },
      },
    };
    const builder = await createBuilder({ root: rootDir, logLevel: "warn", plugins: [skipPlugin] });
    await builder.buildApp();
  }

  // https://github.com/nitrojs/nitro/issues/5005
  it("reuses the existing output when the entry is not `index.mjs`", async () => {
    await cleanup();
    await build(false);
    await build(true);

    const entry = pathToFileURL(join(rootDir, ".output/server/index.mjs")).href;
    const { default: server } = await import(entry);
    const res = await server.fetch(new Request("http://localhost/"));
    expect(await res.text()).toBe("ssr service");
  }, 60_000);

  afterAll(cleanup);
});
