import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import type { ViteDevServer } from "vite";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("../examples/vite-ssr-react", import.meta.url));

function getBaseURL(server: ViteDevServer): string {
  const addr = server.httpServer?.address() as {
    port: number;
    address: string;
    family: string;
  };
  return `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
}

/**
 * Intercept messages sent via server.ws.send and collect them for a duration.
 */
function collectWsMessages(server: ViteDevServer, duration: number): Promise<any[]> {
  return new Promise((resolve) => {
    const messages: any[] = [];
    const origSend = server.ws.send.bind(server.ws);
    server.ws.send = function (payload: any) {
      messages.push(payload);
      return origSend(payload);
    };
    setTimeout(() => {
      server.ws.send = origSend;
      resolve(messages);
    }, duration);
  });
}

describe("vite hotUpdate", () => {
  let server: ViteDevServer;
  const appFile = join(rootDir, "src/app.tsx");
  const serverFile = join(rootDir, "src/entry-server.tsx");
  let originalApp: string;
  let originalServer: string;

  beforeAll(async () => {
    originalApp = readFileSync(appFile, "utf-8");
    originalServer = readFileSync(serverFile, "utf-8");

    process.chdir(rootDir);
    server = await createServer({ root: rootDir });
    await server.listen("0" as unknown as number);

    // Fetch the page so the SSR environment loads all modules
    await fetch(getBaseURL(server) + "/");
    await new Promise((r) => setTimeout(r, 1000));
  }, 30_000);

  afterAll(async () => {
    writeFileSync(appFile, originalApp);
    writeFileSync(serverFile, originalServer);
    await server?.close();
  });

  test("editing shared module does not trigger browser full-reload", async () => {
    const collecting = collectWsMessages(server, 2000);

    const modified = originalApp.replace("Nitro + Vite + React", "Nitro + Vite + React EDITED");
    writeFileSync(appFile, modified);

    const messages = await collecting;

    const fullReloads = messages.filter((m) => typeof m === "object" && m?.type === "full-reload");
    expect(
      fullReloads,
      "browser should not receive full-reload for shared module edits"
    ).toHaveLength(0);

    // Server should render updated content on next request
    const html = await fetch(getBaseURL(server) + "/").then((r) => r.text());
    expect(html).toContain("Nitro + Vite + React EDITED");

    // Restore
    writeFileSync(appFile, originalApp);
    await new Promise((r) => setTimeout(r, 500));
  });

  test("editing server-only module does not trigger browser full-reload by default", async () => {
    const collecting = collectWsMessages(server, 2000);

    const modified = originalServer.replace(
      '<meta name="viewport"',
      '<meta name="description" content="hot-update-test" />\n            <meta name="viewport"'
    );
    writeFileSync(serverFile, modified);

    const messages = await collecting;

    const fullReloads = messages.filter((m) => typeof m === "object" && m?.type === "full-reload");
    expect(
      fullReloads,
      "browser should not receive full-reload when serverReload is disabled (default)"
    ).toHaveLength(0);

    // Server should render updated content on next request
    const html = await fetch(getBaseURL(server) + "/").then((r) => r.text());
    expect(html).toContain('content="hot-update-test"');

    // Restore
    writeFileSync(serverFile, originalServer);
  });
});

describe("vite hotUpdate (serverReload: true)", () => {
  let server: ViteDevServer;
  const serverFile = join(rootDir, "src/entry-server.tsx");
  let originalServer: string;

  beforeAll(async () => {
    originalServer = readFileSync(serverFile, "utf-8");

    process.chdir(rootDir);
    server = await createServer({
      root: rootDir,
      configFile: join(rootDir, "vite.config.server-reload.mjs"),
    });
    await server.listen("0" as unknown as number);

    // Fetch the page so the SSR environment loads entry-server.tsx
    await fetch(getBaseURL(server) + "/");
  }, 30_000);

  afterAll(async () => {
    writeFileSync(serverFile, originalServer);
    await server?.close();
  });

  test("editing server-only module triggers browser full-reload when serverReload is enabled", async () => {
    const collecting = collectWsMessages(server, 2000);

    const modified = originalServer.replace(
      '<meta name="viewport"',
      '<meta name="description" content="reload-test" />\n            <meta name="viewport"'
    );
    writeFileSync(serverFile, modified);

    const messages = await collecting;

    const fullReloads = messages.filter((m) => typeof m === "object" && m?.type === "full-reload");
    expect(
      fullReloads,
      "browser should receive full-reload when serverReload is enabled and all modules are server-only"
    ).not.toHaveLength(0);

    // Server should render updated content on next request
    const html = await fetch(getBaseURL(server) + "/").then((r) => r.text());
    expect(html).toContain('content="reload-test"');

    // Restore
    writeFileSync(serverFile, originalServer);
  });
});
