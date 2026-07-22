import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { beforeAll, afterAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:server entry", { sequential: true }, () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./server-entry-fixture", import.meta.url));
  const originalCwd = process.cwd();

  beforeAll(async () => {
    process.chdir(rootDir);
    server = await createServer({ root: rootDir });
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
  });

  test("custom server entry handles page navigations", async () => {
    const res = await fetch(serverURL, {
      headers: { "sec-fetch-dest": "document", accept: "text/html" },
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("/image.png");
  });

  // #4252: routes defined in a custom server entry are invisible to `nitro.routing.routes`,
  // but asset-tagged requests must still reach them instead of dying in Vite as a 404.
  test("custom server entry serves asset-extensioned routes (sec-fetch-dest: image)", async () => {
    const res = await fetch(`${serverURL}/image.png`, {
      headers: { "sec-fetch-dest": "image", accept: "image/*" },
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("PNGDATA");
  });

  // #4252/#4234: same, with `Sec-Fetch-*` absent (plain-HTTP non-loopback origins) so only the
  // extension heuristic tags the request as an asset.
  test("custom server entry serves asset-extensioned routes (sec-fetch-dest absent)", async () => {
    const res = await fetch(`${serverURL}/image.png`, {
      headers: { accept: "*/*" },
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("PNGDATA");
  });

  // A handler response without a content-type must pass through untouched.
  test("custom server entry serves script routes without a content-type", async () => {
    const res = await fetch(`${serverURL}/generated.js`, {
      headers: { "sec-fetch-dest": "script" },
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("generated");
  });

  // #4234 contract: a genuinely missing asset must still not be answered with 200.
  test("missing assets still 404", async () => {
    for (const headers of [{ "sec-fetch-dest": "style" }, { accept: "*/*" }] as Record<
      string,
      string
    >[]) {
      const res = await fetch(`${serverURL}/missing-asset.css`, {
        headers,
        redirect: "manual",
      });
      expect(res.status, JSON.stringify(headers)).not.toBe(200);
    }
  });
});
