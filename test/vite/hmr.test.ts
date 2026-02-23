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
    await pollResponse(`${serverURL}/app/entry-client.ts`, /modified/);
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
});

function openFileForEditing(path: string) {
  const originalContent = readFileSync(path, "utf-8");
  return {
    path,
    update(cb: (content: string) => string) {
      const currentContent = readFileSync(path, "utf-8");
      const newContent = cb(currentContent);
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
  timeout = 5000
): Promise<string> {
  const start = Date.now();
  let lastResponse = "";
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const response = await fetch(url);
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
