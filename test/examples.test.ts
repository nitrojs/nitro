import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { toRequest } from "h3";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

import * as vite from "vite";
import * as rolldownVite from "rolldown-vite";
import { isWindows } from "std-env";

const examplesDir = fileURLToPath(new URL("../examples", import.meta.url));

const useVite = new Set<string>([
  "nano-jsx", // TODO: JSX issue with rolldown
]);

const skip = new Set<string>(["websocket"]);

const skipDev = new Set<string>(["auto-imports", "cached-handler"]);

const skipProd = new Set<string>([
  "vite-ssr-tss-react", // seroval export condition (only happens to test env)
]);

for (const example of await readdir(examplesDir)) {
  if (example.startsWith("_")) continue;
  setupTest(example);
}

function setupTest(name: string) {
  const rootDir = join(examplesDir, name);

  const { createServer, createBuilder } = useVite.has(name)
    ? vite
    : rolldownVite;

  describe.skipIf(skip.has(name) || isWindows)(name, () => {
    type TestContext = {
      fetch: typeof globalThis.fetch;
    };

    function registerTests(ctx: TestContext, mode: string) {
      test(`${name} (${mode})`, async () => {
        const res = await ctx.fetch("/");
        const expectedStatus = name === "custom-error-handler" ? 500 : 200;
        expect(res.status, res.statusText).toBe(expectedStatus);
      });
    }

    describe.skipIf(skipDev.has(name))(`${name} (dev)`, () => {
      let server: vite.ViteDevServer | rolldownVite.ViteDevServer;
      const context: TestContext = {} as any;

      beforeAll(async () => {
        process.chdir(rootDir);
        server = await createServer({ root: rootDir });
        await server.listen("0" as unknown as number);
        const addr = server.httpServer?.address() as {
          port: number;
          address: string;
          family: string;
        };
        const baseURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
        context.fetch = (url, opts) => fetch(baseURL + url, opts);
      }, 30_000);

      afterAll(async () => {
        await server?.close();
      });

      registerTests(context, "dev");
    });

    describe.skipIf(skipProd.has(name))(`${name} (prod)`, () => {
      const context: TestContext = {} as any;

      beforeAll(async () => {
        process.chdir(rootDir);

        process.env.NITRO_PRESET = "standard";
        const builder = await createBuilder({ logLevel: "warn" });
        await builder.buildApp();

        const { default: entryMod } = await import(
          pathToFileURL(join(rootDir, ".output/server/index.mjs")).href
        );

        delete (globalThis as any).document; // Set by nano-jsx!

        expect(entryMod?.fetch).toBeInstanceOf(Function);
        context.fetch = (input, init) => entryMod.fetch(toRequest(input, init));
      }, 30_000);

      registerTests(context, "prod");
    });
  });
}
