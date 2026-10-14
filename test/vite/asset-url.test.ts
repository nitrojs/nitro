import { fileURLToPath } from "node:url";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ViteDevServer } from "vite";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:asset-url", () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./asset-url-fixture", import.meta.url));

  const originalCwd = process.cwd();

  beforeAll(async () => {
    // The fixture is written at test time so the test stays self-contained. It mirrors
    // the #4230 repro: a plain Vite SPA whose only route is the auto-detected
    // `index.html` renderer catch-all, with a `?url`-imported file under `src/`.
    mkdirSync(join(rootDir, "src"), { recursive: true });
    writeFileSync(
      join(rootDir, "index.html"),
      `<!doctype html>
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`
    );
    writeFileSync(join(rootDir, "src", "1.txt"), "hello\n");
    writeFileSync(
      join(rootDir, "src", "main.ts"),
      `import url from "./1.txt?url";

const app = document.getElementById("app")!;
fetch(url)
  .then((res) => res.text())
  .then((text) => (app.textContent = text));
`
    );
    writeFileSync(
      join(rootDir, "vite.config.ts"),
      `import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [nitro()],
});
`
    );
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
    rmSync(rootDir, { recursive: true, force: true });
  });

  // #4230: `import url from "./1.txt?url"` compiles to a bare root-relative path
  // (`/src/1.txt`) that the browser then `fetch()`es. With only the `index.html`
  // renderer catch-all registered, the request must reach Vite's static serving,
  // not be swallowed by the catch-all.
  for (const headers of [{ "sec-fetch-dest": "empty", accept: "*/*" }, { accept: "*/*" }] as Record<
    string,
    string
  >[]) {
    test(`serves a ?url-imported file fetched via fetch() ${JSON.stringify(headers)}`, async () => {
      const res = await fetch(`${serverURL}/src/1.txt`, {
        headers,
        redirect: "manual",
      });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("hello\n");
    });
  }

  // A page navigation to the same path still renders the catch-all page.
  test("keeps navigations to file-like paths on the renderer", async () => {
    const res = await fetch(`${serverURL}/src/1.txt`, {
      headers: { "sec-fetch-dest": "document", accept: "text/html" },
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});
