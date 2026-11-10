import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "pathe";
import { isWindows } from "std-env";
import { afterAll, describe, expect, it } from "vitest";
import { build, createDevServer, createNitro, prepare } from "../../src/builder.ts";

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const builder = (process.env.NITRO_BUILDER as "rollup" | "rolldown" | "rspack") || "rolldown";

describe(`dev:reload payload (${builder})`, () => {
  it.skipIf(builder === "rspack" && isWindows)(
    "passes { entry } in dev:reload hook payload",
    async () => {
      const rootDir = mkdtempSync(join(tmpdir(), "nitro-dev-reload-payload-"));
      tmpDirs.push(rootDir);
      mkdirSync(join(rootDir, "routes"));
      writeFileSync(join(rootDir, "package.json"), JSON.stringify({ type: "module" }));
      writeFileSync(join(rootDir, "routes/index.ts"), `export default () => "index";`);

      const nitro = await createNitro({
        rootDir,
        serverDir: ".",
        builder,
        dev: true,
        compatibilityDate: "latest",
        logLevel: 0,
      });
      const server = await createDevServer(nitro).listen({ port: 0 });

      let reloadPayload: { entry?: string } | undefined;
      let onReload: (() => void) | undefined;
      nitro.hooks.hook("dev:reload", (payload) => {
        reloadPayload = payload;
        onReload?.();
      });
      const reloaded = () => new Promise<void>((resolve) => (onReload = resolve));

      try {
        await prepare(nitro);
        const ready = reloaded();
        await build(nitro);
        await ready;

        expect(reloadPayload).toBeDefined();
        expect(reloadPayload?.entry).toBe(resolve(nitro.options.output.serverDir, "index.mjs"));
      } finally {
        await server.close();
        await nitro.close();
      }
    }
  );
});
