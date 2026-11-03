import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile, rm, writeFile } from "node:fs/promises";
import type { ViteDevServer } from "vite";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, it, test } from "vitest";

const { createServer, createBuilder, version } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./ssr-outlet-fixture", import.meta.url));

// The page template is compiled at build time, with the `<!--ssr-outlet-->` rendered by the `ssr` service
describe.each([false, true])("vite: ssr outlet (dev, bundledDev=%s)", (bundledDev) => {
  const skip = bundledDev && Number(version.split(".")[0]) < 8;
  let server: ViteDevServer;
  let serverURL: string;

  beforeAll(async () => {
    if (skip) {
      return;
    }
    server = await createServer({ root: rootDir, logLevel: "warn", experimental: { bundledDev } });
    await server.listen("0" as unknown as number);
    serverURL = server.resolvedUrls!.local[0]!;
  }, 30_000);

  afterAll(async () => {
    await server?.close();
  });

  const fetchPage = (path: string) =>
    fetch(new URL(path, serverURL), { headers: { accept: "text/html" } }).then((r) => r.text());

  const editFile = async (file: string, from: string, to: string, test: () => Promise<void>) => {
    const path = join(rootDir, file);
    const source = await readFile(path, "utf8");
    // The file watcher drops a change that follows the previous one within 50ms
    const waitForWatcher = () => new Promise((resolve) => setTimeout(resolve, 100));
    try {
      await waitForWatcher();
      await writeFile(path, source.replace(from, to));
      await test();
    } finally {
      await waitForWatcher();
      await writeFile(path, source);
    }
    await expect.poll(() => fetchPage("/"), { timeout: 10_000 }).toContain(from);
  };

  test.skipIf(skip)("renders the outlet and template syntax", async () => {
    const html = await fetchPage("/about");
    expect(html).toContain(`<div id="app"><main>ssr: /about</main></div>`);
    expect(html).toContain("<p>method: GET</p>");
    expect(html).toContain("<p>fetchViteEnv: function</p>");
    expect(html).toContain("<p>fetchService: function</p>");
    expect(html).toContain(bundledDev ? "bundledDevClient" : "/@vite/client");
    expect(html).not.toContain("<!--ssr-outlet-->");
  });

  // A browser reloads on Vite's `full-reload` and must get the edited page right away
  test.skipIf(skip || bundledDev)("renders the edited template on the client reload", async () => {
    expect(await fetchPage("/")).toContain("<title>ssr outlet</title>");
    const ws = new WebSocket(serverURL.replace(/^http/, "ws"), "vite-hmr");
    await new Promise((resolve) => ws.addEventListener("open", resolve));
    try {
      const reload = new Promise<void>((resolve) => {
        ws.addEventListener("message", (event) => {
          if (JSON.parse(event.data).type === "full-reload") {
            resolve();
          }
        });
      });
      await editFile(
        "index.html",
        "<title>ssr outlet</title>",
        "<title>edited</title>",
        async () => {
          await reload;
          const html = await fetchPage("/");
          expect(html).toContain("<title>edited</title>");
          expect(html).toContain("<main>ssr: /</main>");
        }
      );
    } finally {
      ws.close();
    }
  });

  test.skipIf(skip || !bundledDev)("renders the edited template", async () => {
    expect(await fetchPage("/")).toContain("<title>ssr outlet</title>");
    await editFile("index.html", "<title>ssr outlet</title>", "<title>edited</title>", () =>
      expect.poll(() => fetchPage("/"), { timeout: 10_000 }).toContain("<title>edited</title>")
    );
  });

  // The page HTML depends on more than the template (e.g. inline style imports)
  test.skipIf(skip)("renders the page again when its dependencies change", async () => {
    const pluginRuns = () =>
      fetch(new URL("/api/plugin-runs", serverURL))
        .then((r) => r.json() as Promise<{ runs: number }>)
        .then((r) => r.runs);
    expect(await fetchPage("/")).toContain("rebeccapurple");
    const runs = await pluginRuns();
    await editFile("src/style.css", "rebeccapurple", "tomato", () =>
      expect.poll(() => fetchPage("/"), { timeout: 10_000 }).toContain("tomato")
    );
    // Only the template module is reloaded, not the app
    expect(await pluginRuns()).toBe(runs);
  });
});

describe("vite: ssr outlet (build)", () => {
  const cleanup = () =>
    Promise.all(
      [".output", "node_modules"].map((dir) =>
        rm(join(rootDir, dir), { recursive: true, force: true })
      )
    );

  let server: { fetch: (req: Request) => Promise<Response> };

  beforeAll(async () => {
    await cleanup();
    const builder = await createBuilder({ root: rootDir, logLevel: "warn" });
    await builder.buildApp();
    const entry = pathToFileURL(join(rootDir, ".output/server/index.mjs")).href;
    server = (await import(entry)).default;
  }, 60_000);

  afterAll(cleanup);

  it("renders the outlet and template syntax", async () => {
    const res = await server.fetch(new Request("http://localhost/about"));
    const html = await res.text();
    expect(html).toContain(`<div id="app"><main>ssr: /about</main></div>`);
    expect(html).toContain("<p>method: GET</p>");
    expect(html).toContain("<p>fetchViteEnv: function</p>");
    expect(html).toContain("<p>fetchService: function</p>");
    expect(html).toMatch(/<script type="module" crossorigin src="\/assets\/[^"]+\.js"><\/script>/);
    expect(html).not.toContain("<!--ssr-outlet-->");
  });

  it("renders the outlet when prerendering", async () => {
    const html = await readFile(join(rootDir, ".output/public/prerendered/index.html"), "utf8");
    expect(html).toContain(`<div id="app"><main>ssr: /prerendered</main></div>`);
    expect(html).toContain("<p>method: GET</p>");
    expect(html).toContain("<p>fetchViteEnv: function</p>");
    expect(html).toContain("<p>fetchService: function</p>");
  });
});
