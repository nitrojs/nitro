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
    server = await createServer({ root: rootDir });

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
    let restored = false;
    for (const file of Object.values(files)) {
      if (file.restore()) {
        restored = true;
      }
    }
    if (restored) {
      await waitFor(() => wsMessages.length > 0, 500);
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

  // Regression test for the dev worker reusing stale evaluations across
  // reloads: the fixture's `dep-crawler` plugin re-transforms `dep.ts` as a
  // side effect of transforming `api/crawled.ts`, so by the time the
  // reloading worker's module runner re-fetches `dep.ts`, its transform is
  // already populated and `fetchModule` answers `{cache: true}`. Unless
  // `reload()` clears the runner's evaluated modules, the old `dep.ts`
  // evaluation is reused and responses stay stale until a manual restart.
  test("editing a dependency crawled by another plugin", async () => {
    const res = (await fetch(`${serverURL}/api/crawled`).then((r) => r.json())) as {
      value: string;
    };
    expect(res.value).toBe("original");

    files.dep.update((content) => content.replace(`"original"`, `"modified"`));
    await pollResponse(`${serverURL}/api/crawled`, /modified/);
    expect(wsMessages).toMatchObject([{ type: "full-reload" }]);
  });
});

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
  };
}

function waitFor(check: () => boolean, duration: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve) => {
    const poll = () => {
      if (check() || Date.now() - start > duration) {
        resolve();
      } else {
        setTimeout(poll, 10);
      }
    };
    poll();
  });
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
