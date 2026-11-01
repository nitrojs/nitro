import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import type { ViteDevServer } from "vite";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite: dev error page recovery", { concurrent: false }, () => {
  let server: ViteDevServer;
  let serverURL: string;
  const wsMessages: unknown[] = [];

  const rootDir = fileURLToPath(new URL("./dev-error-page-fixture", import.meta.url));
  const stateFile = join(rootDir, "state.ts");
  const originalState = readFileSync(stateFile, "utf-8");
  const notesFile = join(rootDir, "notes.txt");

  const fetchPage = (init: { accept?: string; method?: string; dest?: string } = {}) =>
    fetch(serverURL, {
      method: init.method || "GET",
      headers: { accept: init.accept || "text/html", "sec-fetch-dest": init.dest || "document" },
    });

  const waitForMessage = async (match: (message: any) => boolean) => {
    for (let i = 0; i < 100 && !wsMessages.some(match); i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(wsMessages.some(match)).toBe(true);
  };

  beforeAll(async () => {
    writeFileSync(notesFile, "");
    process.chdir(rootDir);
    server = await createServer({ root: rootDir, logLevel: "warn" });
    const originalSend = server.ws.send.bind(server.ws) as (...args: unknown[]) => void;
    server.ws.send = ((...args: unknown[]) => {
      wsMessages.push(args[0]);
      return originalSend(...args);
    }) as typeof server.ws.send;
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    writeFileSync(stateFile, originalState);
    rmSync(notesFile, { force: true });
    await server?.close();
  });

  test("leaves non-HTML and non-GET error responses untouched", async () => {
    const json = await fetchPage({ accept: "application/json" });
    expect(json.status).toBe(500);
    expect(await json.text()).not.toContain("@vite/client");

    const post = await fetchPage({ method: "POST" });
    expect(post.status).toBe(500);
    expect(await post.text()).not.toContain("@vite/client");
  });

  test("does not notify the browser when no error page was served", async () => {
    wsMessages.length = 0;
    writeFileSync(stateFile, originalState + "\n");
    await waitForMessage((m) => m?.type === "full-reload");
    expect(wsMessages).not.toContain("nitro:server-update");
  });

  test("does not inject into fetch() requests, which still re-arm the notification", async () => {
    const res = await fetchPage({ dest: "empty" });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("@vite/client");

    wsMessages.length = 0;
    writeFileSync(stateFile, originalState + "\n\n");
    await waitForMessage((m) => m === "nitro:server-update");
  });

  test("connects the HTML error page to HMR", async () => {
    const res = await fetchPage();
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain("broken page");
    expect(html).toContain(`await import("/@vite/client")`);
    expect(html).toContain(`hot.on("nitro:server-update"`);
    expect(html.trimEnd().endsWith("</script>")).toBe(true);
  });

  test("does not notify the error page for files outside the module graph", async () => {
    wsMessages.length = 0;
    writeFileSync(notesFile, "changed");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(wsMessages).not.toContain("nitro:server-update");
  });

  test("notifies the error page when a server module changes", async () => {
    wsMessages.length = 0;
    writeFileSync(stateFile, originalState.replace("true", "false"));
    await waitForMessage((m) => m === "nitro:server-update");

    let res = await fetchPage();
    for (let i = 0; i < 50 && res.status !== 200; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      res = await fetchPage();
    }
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("@vite/client");
  });
});
