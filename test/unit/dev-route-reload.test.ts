import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { build, createDevServer, createNitro, prepare } from "../../src/builder.ts";

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const builders = [process.env.NITRO_BUILDER === "rspack" ? "rspack" : "rolldown"] as const;

describe.each(builders)("dev route reload (%s)", (builder) => {
  it("serves added routes and stops serving removed ones", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-dev-route-reload-"));
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
    const errors: unknown[] = [];
    nitro.hooks.hook("dev:error", (error) => {
      errors.push(error);
    });
    let onReload: (() => void) | undefined;
    nitro.hooks.hook("dev:reload", () => onReload?.());
    const reloaded = () => new Promise<void>((resolve) => (onReload = resolve));
    const get = async (path: string) => {
      const res = await fetch(new URL(path, server.url));
      return [res.status, await res.text()] as const;
    };

    try {
      await prepare(nitro);
      let ready = reloaded();
      await build(nitro);
      await ready;
      expect(await get("/")).toEqual([200, "index"]);

      const route = join(rootDir, "routes/added.ts");
      ready = reloaded();
      writeFileSync(route, `export default () => "added";`);
      await ready;
      expect(await get("/added")).toEqual([200, "added"]);

      ready = reloaded();
      rmSync(route);
      await ready;
      expect((await get("/added"))[0]).toBe(404);
      expect(await get("/")).toEqual([200, "index"]);
      // TODO: the rolldown watcher builds the stale routes before the scan dirs watcher reloads
      if (builder === "rspack") {
        expect(errors).toEqual([]);
      }
    } finally {
      await server.close();
      await nitro.close();
    }
  });
});
