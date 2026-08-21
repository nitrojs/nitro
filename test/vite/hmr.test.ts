import { join } from "pathe";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { describe, test, expect, beforeAll, afterEach, afterAll } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:hmr", { sequential: true }, () => {
  let server: ViteDevServer;
  let serverURL: string;
  const wsMessages: any[] = [];

  const rootDir = fileURLToPath(new URL("./hmr-fixture", import.meta.url));

  const files = {
    client: openFileForEditing(join(rootDir, "app/entry-client.ts")),
    api: openFileForEditing(join(rootDir, "api/state.ts")),
    shared: openFileForEditing(join(rootDir, "shared.ts")),
    ssr: openFileForEditing(join(rootDir, "app/entry-server.ts")),
    dep: openFileForEditing(join(rootDir, "dep.ts")),
  };

  beforeAll(async () => {
    process.chdir(rootDir);
    server = await createServer({ root: rootDir, logLevel: "warn" });

    const originalSend = server.ws.send.bind(server.ws);
    server.ws.send = function (payload: any) {
      wsMessages.push(payload);
      return originalSend(payload);
    };

    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;

    const html = await fetch(serverURL).then((r) => r.text());
    expect(html).toContain("<h1>SSR Page</h1>");
    expect(html).toContain("[SSR] state: 1");
    expect(html).toContain("[API] state: 1");
  }, 30_000);

  afterAll(async () => {
    await server?.close();
  });

  afterEach(async () => {
    wsMessages.length = 0;
    const restored = Object.values(files).filter((file) => file.restore());
    if (restored.length > 0) {
      // The client is notified before the dev worker reloads, so waiting for a
      // websocket message is not enough: wait until the restored fixture is
      // served again, otherwise the next test observes a reload caused by this
      // one. Writes that follow each other closely can also be coalesced into a
      // single watcher event, so re-touch the fixtures while waiting.
      for (let attempt = 0; !(await fixtureRestored()); attempt++) {
        if (attempt >= 20) {
          throw new Error("dev server kept serving the modified fixture");
        }
        if (attempt % 5 === 4) {
          for (const file of restored) {
            file.touch();
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await waitForStableEvals();
    }
    wsMessages.length = 0;
  });

  test("editing API entry", async () => {
    files.api.update((content) =>
      content.replace("({ state })", '({ state: state + " (modified)" })')
    );
    await pollResponse(`${serverURL}/api/state`, /modified/);
    expect(wsMessages).toMatchObject([{ type: "full-reload" }]);
  });

  test("Editing client entry (no full-reload)", async () => {
    files.client.update((content) => content.replace(`+ ""`, `+ " (modified)"`));
    await pollResponse(`${serverURL}/app/entry-client.ts`, /modified/, 5000, {
      "sec-fetch-dest": "script",
    });
    expect(wsMessages.length).toBe(0);
  });

  test("editing SSR entry (no full-reload)", async () => {
    files.ssr.update((content) =>
      content.replace("<h1>SSR Page</h1>", "<h1>Modified SSR Page</h1>")
    );
    await pollResponse(serverURL, /Modified SSR Page/);
    expect(wsMessages.length).toBe(0);
  });

  test("Editing shared entry", async () => {
    files.shared.update((content) => content.replace(`state = 1`, `state = 2`));
    await pollResponse(
      `${serverURL}`,
      (txt) => txt.includes("state: 2") && !txt.includes("state: 1")
    );
    expect(wsMessages).toMatchObject([{ type: "full-reload" }]);
  });

  // Regression test for reload scoping: a `full-reload` sent for the nitro
  // environment must not re-evaluate the ssr runner's modules, which would
  // reset all module state (framework singletons, caches) of an environment
  // that has nothing stale to re-evaluate.
  test("editing a nitro-only file keeps ssr module state", async () => {
    const evalsBefore = await ssrEvals();

    files.api.update((content) =>
      content.replace("({ state })", '({ state: state + " (nitro only)" })')
    );
    await pollResponse(`${serverURL}/api/state`, /nitro only/);

    expect(await ssrEvals()).toBe(evalsBefore);
    expect(wsMessages).toMatchObject([{ type: "full-reload" }]);
  });

  // Regression test for reload scoping within one environment: only the
  // changed file and its importers may be re-evaluated. `nitro-state.ts` is
  // imported by `api/evals.ts` alone, so an edit to `api/state.ts` cannot
  // affect it — dropping the whole module graph on reload would reset it,
  // along with every runtime singleton (storage, caches, plugin state).
  test("editing a nitro file keeps unrelated nitro module state", async () => {
    const evalsBefore = await nitroEvals();

    files.api.update((content) =>
      content.replace("({ state })", '({ state: state + " (unrelated)" })')
    );
    await pollResponse(`${serverURL}/api/state`, /unrelated/);

    expect(await nitroEvals()).toBe(evalsBefore);
  });

  // Regression test for the dev worker reusing stale evaluations across
  // reloads: the fixture's `dep-crawler` plugin re-transforms `dep.ts` as a
  // side effect of transforming `api/crawled.ts`, so by the time the
  // reloading worker's module runner re-fetches `dep.ts`, its transform is
  // already populated and `fetchModule` answers `{cache: true}`. Unless
  // `reload()` invalidates the changed file, the old `dep.ts` evaluation is
  // reused and responses stay stale until a manual restart.
  test("editing a dependency crawled by another plugin", async () => {
    await pollResponse(`${serverURL}/api/crawled`, /original/);

    files.dep.update((content) => content.replace(`"original"`, `"modified"`));
    await pollResponse(`${serverURL}/api/crawled`, /modified/);
    expect(wsMessages).toMatchObject([{ type: "full-reload" }]);
  });

  async function ssrEvals(): Promise<number> {
    return matchCounter(await fetch(serverURL).then((r) => r.text()), /\[SSR\] evals: (\d+)/);
  }

  async function nitroEvals(): Promise<number> {
    return matchCounter(
      await fetch(`${serverURL}/api/evals`).then((r) => r.text()),
      /"nitroEvals":\s*(\d+)/
    );
  }

  // Whether every fixture edit has been rolled back by the dev worker.
  async function fixtureRestored(): Promise<boolean> {
    const [page, crawled] = await Promise.all([
      fetch(serverURL).then((r) => r.text()),
      fetch(`${serverURL}/api/crawled`).then((r) => r.text()),
    ]);
    return (
      page.includes("<h1>SSR Page</h1>") &&
      page.includes("[SSR] state: 1</p>") &&
      page.includes("[API] state: 1</p>") &&
      crawled.includes(`"original"`)
    );
  }

  // Waits until the dev worker stops re-evaluating modules in either
  // environment, so a test never observes a reload queued by a previous one.
  async function waitForStableEvals(): Promise<void> {
    let last = "";
    let stable = 0;
    for (let i = 0; i < 30; i++) {
      const current = `${await ssrEvals()}/${await nitroEvals()}`;
      stable = current === last ? stable + 1 : 0;
      last = current;
      if (stable === 2) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`dev worker never settled (last evals: ${last})`);
  }
});

function matchCounter(body: string, re: RegExp): number {
  const match = body.match(re);
  if (!match) {
    throw new Error(`No ${re} counter in response: ${body.slice(0, 500)}`);
  }
  return Number(match[1]);
}

function openFileForEditing(path: string) {
  const originalContent = readFileSync(path, "utf-8");
  return {
    path,
    update(cb: (content: string) => string) {
      const currentContent = readFileSync(path, "utf-8");
      const newContent = cb(currentContent);
      if (newContent === currentContent) {
        throw new Error(
          `update(${path}) was a no-op — the fixture is likely already in the modified state.`
        );
      }
      writeFileSync(path, newContent);
    },
    restore() {
      if (readFileSync(path, "utf-8") !== originalContent) {
        writeFileSync(path, originalContent);
        return true;
      }
      return false;
    },
    // Rewrites the file as is, to emit another watcher event for a write that
    // was coalesced with the one before it.
    touch() {
      writeFileSync(path, readFileSync(path, "utf-8"));
    },
  };
}

function pollResponse(
  url: string,
  match: RegExp | ((txt: string) => boolean),
  timeout = 5000,
  headers?: Record<string, string>
): Promise<string> {
  const start = Date.now();
  let lastResponse = "";
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const response = await fetch(url, headers ? { headers } : undefined);
        lastResponse = await response.text();
        if (typeof match === "function" ? match(lastResponse) : match.test(lastResponse)) {
          resolve(lastResponse);
        } else if (Date.now() - start > timeout) {
          reject(
            new Error(
              `Timeout waiting for response to match ${match} at ${url}. Last response: ${lastResponse}`
            )
          );
        } else {
          setTimeout(check, 100);
        }
      } catch (err) {
        reject(err);
      }
    };
    check();
  });
}
