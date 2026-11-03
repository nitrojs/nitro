import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRsbuild } from "@rsbuild/core";
import { execa } from "execa";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { nitro } from "../../src/rsbuild.ts";

describe("rsbuild build --watch", { timeout: 60_000 }, () => {
  // A copy of the SSR fixture, edited by the tests
  const cwd = fileURLToPath(new URL(".tmp/build-watch", import.meta.url));
  let close: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    await rm(cwd, { recursive: true, force: true });
    await mkdir(cwd, { recursive: true });
    await cp(fileURLToPath(new URL("ssr-fixture", import.meta.url)), cwd, {
      recursive: true,
      filter: (src) => !/[/\\](?:node_modules|\.output)$/.test(src),
    });
    const rsbuild = await createRsbuild({
      cwd,
      config: {
        logLevel: "warn",
        source: { entry: { index: "./src/entry-client.js" } },
        html: { template: "./index.html" },
        plugins: [
          nitro({
            serverDir: "./",
            runtimeConfig: { greeting: "from nitro" },
            preset: "standard",
            serveStatic: true,
            logLevel: 1,
          }),
        ],
      },
    });
    ({ close } = await rsbuild.build({ watch: true }));
  }, 60_000);

  afterAll(async () => {
    await close?.();
    await rm(cwd, { recursive: true, force: true });
  });

  test("builds the output", async () => {
    await waitFor({ "/api/hello": '{"api":"hello"}', "/": '<p id="ssr">/ from nitro</p>' });
  });

  test("rebuilds edited routes", async () => {
    await writeFile(join(cwd, "api/hello.ts"), `export default () => ({ api: "edited" });\n`);
    await waitFor({ "/api/hello": '{"api":"edited"}' });
  });

  test("rebuilds added and removed routes", async () => {
    await writeFile(join(cwd, "api/added.ts"), `export default () => ({ api: "added" });\n`);
    await waitFor({ "/api/added": '{"api":"added"}' });
    await rm(join(cwd, "api/added.ts"));
    // Rendered by the SSR renderer again
    await waitFor({ "/api/added": '<p id="ssr">/api/added from nitro</p>' });
  });

  test("rebuilds the ssr environment", async () => {
    await writeFile(
      join(cwd, "src/entry-server.js"),
      `export default { fetch: (req) => '<p id="ssr">edited ' + new URL(req.url).pathname + "</p>" };\n`
    );
    await waitFor({ "/": '<p id="ssr">edited /</p>' });
  });

  test("rebuilds the client", async () => {
    await writeFile(
      join(cwd, "index.html"),
      `<!doctype html><html><head><title>edited</title></head><body><div id="app"><!--ssr-outlet--></div></body></html>\n`
    );
    await waitFor({ "/": "<title>edited</title>" });
  });

  /** Fetches the output (in a new process, with fresh modules) until the responses match. */
  async function waitFor(expected: Record<string, string>, timeout = 20_000) {
    const start = Date.now();
    let results: Record<string, string | number> | undefined;
    while (Date.now() - start < timeout) {
      results = await fetchOutput(Object.keys(expected)).catch(() => undefined);
      const matches = Object.entries(expected).every(([path, value]) =>
        String(results?.[path]).includes(value)
      );
      if (matches) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect(results).toEqual(expected);
  }

  async function fetchOutput(paths: string[]): Promise<Record<string, string | number>> {
    const script = /* js */ `
      const { default: server } = await import(${JSON.stringify(join(cwd, ".output/server/index.mjs"))});
      const results = {};
      for (const path of ${JSON.stringify(paths)}) {
        const res = await server.fetch(new Request("http://localhost" + path, { headers: { accept: "text/html" } }));
        results[path] = res.status === 200 ? await res.text() : res.status;
      }
      console.log(JSON.stringify(results));
    `;
    const { stdout } = await execa(process.execPath, ["--input-type=module", "-e", script]);
    return JSON.parse(stdout.trim().split("\n").pop()!);
  }
});
