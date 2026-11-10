import { join } from "node:path";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execa } from "execa";
import { resolveModuleURL } from "exsolve";
import { toRequest } from "h3";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

import type { ViteDevServer } from "vite";
import { existsSync } from "node:fs";

const examplesDir = fileURLToPath(new URL("../examples", import.meta.url));

const { createServer, createBuilder, rolldownVersion } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const isRolldown = !!rolldownVersion;

const skip = new Set<string>([
  "websocket",
  ...(isRolldown
    ? [
        // TODO: Cannot read properties of null (reading 'use')
        "vite-rsc",
      ]
    : [
        "vite-rsc",
        // @vitejs/plugin-react depends on vite 8 vite/internal import
        "vite-ssr-react",
        "vite-ssr-tsr-react",
        "vite-ssr-tss-react",
      ]),
]);

const skipDev = new Set<string>(["cached-handler"]);

const skipProd = new Set<string>(isRolldown ? [] : []);

for (const example of await readdir(examplesDir)) {
  if (example.startsWith("_")) continue;
  if (existsSync(join(examplesDir, example, "rsbuild.config.ts"))) {
    setupTest(example, "rsbuild");
  } else if (existsSync(join(examplesDir, example, "index.html"))) {
    setupTest(example, "vite");
  }
  const pkg = JSON.parse(await readFile(join(examplesDir, example, "package.json"), "utf8"));
  if (/\bvitest\b/.test(pkg.scripts?.test || "")) {
    setupVitestTest(example);
  }
}

// Runs the example's own Vitest suite, as `pnpm test` does in the example
function setupVitestTest(name: string) {
  const rootDir = join(examplesDir, name);
  test.skipIf(skip.has(name))(
    `${name} (vitest)`,
    async () => {
      const outDir = await mkdtemp(join(tmpdir(), "nitro-example-vitest-"));
      const outputFile = join(outDir, "results.json");
      // A clean environment, as when users run Vitest (no `NODE_ENV`, `VITEST_*` or `NITRO_PRESET`)
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => key !== "NODE_ENV" && key !== "NITRO_PRESET" && !key.startsWith("VITEST")
        )
      );
      try {
        const vitestPkg = resolveModuleURL("vitest/package.json", { from: rootDir + "/" });
        const { stdout, stderr } = await execa(
          process.execPath,
          [
            fileURLToPath(new URL("vitest.mjs", vitestPkg)),
            "run",
            "--reporter=json",
            `--outputFile=${outputFile}`,
          ],
          { cwd: rootDir, env, extendEnv: false, reject: false }
        );
        const results = existsSync(outputFile)
          ? JSON.parse(await readFile(outputFile, "utf8"))
          : undefined;
        const failures = (results?.testResults || []).flatMap((file: any) => [
          ...(file.status === "failed" && file.message ? [`${file.name}: ${file.message}`] : []),
          ...file.assertionResults
            .filter((t: any) => t.status !== "passed")
            .map((t: any) => `${t.fullName}: ${t.failureMessages.join("\n")}`),
        ]);
        expect(failures, stdout + stderr).toEqual([]);
        expect(results?.success, stdout + stderr).toBe(true);
        expect(results.numPassedTests).toBeGreaterThan(0);
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
    },
    60_000
  );
}

function setupTest(name: string, tool: "vite" | "rsbuild") {
  const rootDir = join(examplesDir, name);

  describe.skipIf(skip.has(name))(name, () => {
    type TestContext = {
      fetch: typeof globalThis.fetch;
    };

    function registerTests(ctx: TestContext, mode: string) {
      test(`${name} (${mode})`, async () => {
        const res = await ctx.fetch("/");
        const expectedStatus = name === "custom-error-handler" ? 500 : 200;
        if (res.status !== expectedStatus) {
          const text = await res.text();
          console.error(`Unexpected response ${res.status} ${res.statusText}\n${text}`);
        }
        expect(res.status, res.statusText).toBe(expectedStatus);
      });

      // Pages are rendered by the server with the client scripts (served in dev)
      test.runIf(tool === "rsbuild")(`${name} (${mode}) client scripts`, async () => {
        const res = await ctx.fetch("/", { headers: { accept: "text/html" } });
        const scripts = [...(await res.text()).matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)];
        expect(scripts.length).toBeGreaterThan(0);
        if (mode === "dev") {
          for (const [, src] of scripts) {
            expect((await ctx.fetch(src!)).status, src).toBe(200);
          }
        }
      });
    }

    describe.skipIf(skipDev.has(name))(`${name} (dev)`, () => {
      let server: ViteDevServer | { close: () => Promise<void> };
      const context: TestContext = {} as any;
      const nodeEnv = process.env.NODE_ENV;

      beforeAll(async () => {
        process.chdir(rootDir);
        if (tool === "rsbuild") {
          // As `rsbuild dev` (Rsbuild emits hashed file names with `NODE_ENV=production`)
          process.env.NODE_ENV = "development";
          const rsbuild = await createRsbuild(rootDir);
          const result = await rsbuild.startDevServer({ getPortSilently: true });
          server = result.server;
          const baseURL = result.urls[0]!.replace(/\/$/, "");
          context.fetch = (url, opts) => fetch(baseURL + url, opts);
          return;
        }
        const viteServer = await createServer({ root: rootDir });
        server = viteServer;
        await viteServer.listen("0" as unknown as number);
        const addr = viteServer.httpServer?.address() as {
          port: number;
          address: string;
          family: string;
        };
        const baseURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
        context.fetch = (url, opts) => fetch(baseURL + url, opts);
      }, 30_000);

      afterAll(async () => {
        await server?.close();
        process.env.NODE_ENV = nodeEnv;
      });

      registerTests(context, "dev");
    });

    describe.skipIf(skipProd.has(name))(`${name} (prod)`, () => {
      const context: TestContext = {} as any;

      beforeAll(async () => {
        process.chdir(rootDir);

        process.env.NITRO_PRESET = "standard";
        if (tool === "rsbuild") {
          const rsbuild = await createRsbuild(rootDir);
          await (await rsbuild.build()).close();
        } else {
          const builder = await createBuilder({ logLevel: "warn" });
          await builder.buildApp();
        }

        delete globalThis.__nitro__;

        // The module runner of Vitest does not resolve the `import("./" + chunk)` of Rspack
        // chunk loading against a file URL
        const entry = join(rootDir, ".output/server/index.mjs");
        const { default: entryMod } = await import(
          tool === "rsbuild" ? entry : pathToFileURL(entry).href
        );

        delete (globalThis as any).document; // Set by nano-jsx!

        expect(entryMod?.fetch).toBeInstanceOf(Function);
        context.fetch = (input, init) => entryMod.fetch(toRequest(input, init));
      }, 30_000);

      registerTests(context, "prod");
    });
  });
}

async function createRsbuild(cwd: string) {
  const { createRsbuild, loadConfig } = await import("@rsbuild/core");
  const { content } = await loadConfig({ cwd });
  return createRsbuild({
    cwd,
    config: { ...content, logLevel: "warn", server: { ...content.server, port: 0 } },
  });
}
