import { fileURLToPath, pathToFileURL } from "node:url";
import { readdir, rm } from "node:fs/promises";
import { join } from "pathe";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build, createNitro, prepare } from "nitro/builder";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./asset-url-fixture", import.meta.url));

// #4930: files referenced with `new URL("./file", import.meta.url)`
describe("vite: files referenced with `new URL(..., import.meta.url)`", () => {
  describe("dev", () => {
    let server: ViteDevServer;
    let serverURL: string;
    const originalCwd = process.cwd();

    beforeAll(async () => {
      process.chdir(rootDir);
      server = await createServer({ root: rootDir, logLevel: "warn" });
      await server.listen("0" as unknown as number);
      const addr = server.httpServer?.address() as {
        port: number;
        address: string;
        family: string;
      };
      serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
    }, 30_000);

    afterAll(async () => {
      await server?.close();
      process.chdir(originalCwd);
    });

    it("resolves files next to the original modules", async () => {
      expect(await fetch(`${serverURL}/route`).then((r) => r.json())).toEqual({
        href: pathToFileURL(join(rootDir, "files/route.txt")).href,
        text: "route file\n",
      });
      expect(await fetch(`${serverURL}/service`).then((r) => r.json())).toEqual({
        href: pathToFileURL(join(rootDir, "node_modules/@fixture/asset-url-dep/data.txt")).href,
        text: "dependency file\n",
      });
    });
  });

  describe("build", () => {
    const outDir = join(rootDir, ".tmp/output");
    let serverFetch: (req: Request) => Promise<Response>;

    beforeAll(async () => {
      await rm(outDir, { recursive: true, force: true });
      // Service entries are resolved from the working directory
      const originalCwd = process.cwd();
      process.chdir(rootDir);
      try {
        const nitro = await createNitro({
          rootDir,
          output: { dir: outDir },
          builder: "vite",
          // @ts-expect-error for testing
          __vitePkg__: process.env.NITRO_VITE_PKG,
        });
        try {
          await prepare(nitro);
          await build(nitro);
        } finally {
          await nitro.close();
        }
      } finally {
        process.chdir(originalCwd);
      }
      serverFetch = await import(join(outDir, "server/index.mjs")).then((m) => m.default.fetch);
    }, 60_000);

    it("emits files to the server output", async () => {
      const get = (path: string) =>
        serverFetch(new Request(`http://localhost${path}`)).then(
          (r) => r.json() as Promise<{ href: string; text: string }>
        );
      const assetsURL = pathToFileURL(join(outDir, "server/assets")).href + "/";
      const route = await get("/route");
      expect(route.href.startsWith(assetsURL)).toBe(true);
      expect(route.href.slice(assetsURL.length)).toMatch(/^route-[\w-]+\.txt$/);
      expect(route.text).toBe("route file\n");
      const service = await get("/service");
      expect(service.href.startsWith(assetsURL)).toBe(true);
      expect(service.href.slice(assetsURL.length)).toMatch(/^data-[\w-]+\.txt$/);
      expect(service.text).toBe("dependency file\n");
    });

    it("does not write other assets to the server output", async () => {
      const files = await readdir(join(outDir, "server/assets"));
      expect(files.sort()).toEqual([
        expect.stringMatching(/^data-[\w-]+\.txt$/),
        expect.stringMatching(/^route-[\w-]+\.txt$/),
      ]);
    });
  });
});
