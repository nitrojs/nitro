import { get, type IncomingMessage } from "node:http";
import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { beforeAll, afterAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:html template", () => {
  let server: ViteDevServer;
  let serverURL: string;
  let addr: { port: number; address: string; family: string };

  const rootDir = fileURLToPath(new URL("./html-template-fixture", import.meta.url));

  beforeAll(async () => {
    server = await createServer({ root: rootDir, logLevel: "warn" });
    await server.listen("0" as unknown as number);
    addr = server.httpServer?.address() as typeof addr;
    serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    await server?.close();
  });

  // Relative imports in inline `<style>` resolve against the template file, not the root dir.
  test("resolves relative imports in inline styles", async () => {
    const res = await fetch(serverURL, { headers: { accept: "text/html" } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<h1>html template</h1>");
    expect(html).toContain("rebeccapurple");
    expect(html).not.toContain('@import "./src/style.css"');
  });

  // #4230: `import url from "./1.txt?url"` compiles to a bare root-relative path that the
  // browser `fetch()`es; with only the `index.html` renderer catch-all it must reach Vite.
  const fetchHeaders: Record<string, string>[] = [
    { "sec-fetch-dest": "empty", accept: "*/*" },
    { accept: "*/*" },
  ];
  for (const headers of fetchHeaders) {
    test(`serves a ?url-imported file via fetch() ${JSON.stringify(headers)}`, async () => {
      const res = await fetch(`${serverURL}/src/1.txt`, { headers });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("hello\n");
    });
  }

  test("keeps navigations to file-like paths on the renderer", async () => {
    const res = await fetch(`${serverURL}/src/1.txt`, {
      headers: { "sec-fetch-dest": "document", accept: "text/html" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  // The file probe must stay inside the root: an existing file outside it is treated like a
  // missing one, so the response does not reveal whether it exists.
  // URL parsing (`fetch()`, `get(url)`) would normalize the dot segments, so send a raw path.
  test("does not probe files outside the root", async () => {
    const res = await new Promise<IncomingMessage>((resolve, reject) => {
      const path = "/%2e%2e/%2e%2e/%2e%2e/package.json";
      get({ host: addr.address, port: addr.port, path, headers: { accept: "*/*" } }, resolve).on(
        "error",
        reject
      );
    });
    res.resume();
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
  });
});

describe("vite:html template (base: /app/)", () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./html-template-fixture", import.meta.url));

  beforeAll(async () => {
    server = await createServer({ root: rootDir, base: "/app/", logLevel: "warn" });
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
  });

  test("serves a ?url-imported file under the base", async () => {
    const res = await fetch(`${serverURL}/app/src/1.txt`, { headers: { accept: "*/*" } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello\n");
  });

  // Vite does not serve root files outside its base, so the file probe must not run there
  // (a Vite 404 for existing files only would reveal which files exist).
  test("does not probe files outside the base", async () => {
    for (const path of ["/src/1.txt", "/src/nope.txt"]) {
      const res = await fetch(`${serverURL}${path}`, { headers: { accept: "*/*" } });
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toContain("text/html");
    }
  });
});
