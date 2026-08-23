import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { rm, mkdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";

const fixtureDir = fileURLToPath(new URL("./nonascii-route-fixture", import.meta.url));
const tmpDir = fileURLToPath(new URL("./nonascii-route-fixture/.tmp", import.meta.url));

// A route path written in Japanese. Registered via `handlers` in the fixture's
// nitro.config.ts so the route pattern stays literal Unicode without needing a
// non-ASCII filename in the repo.
const route = "/について";

describe("non-ASCII route paths", () => {
  it("is prerendered under its own literal path (static preset)", async () => {
    const outDir = join(tmpDir, "static");
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    const nitro = await createNitro({
      rootDir: fixtureDir,
      preset: "static",
      output: { dir: outDir },
      builder: "vite",
    });
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }

    // Reads the file prerendered at the route's own literal path.
    const html = await readFile(join(outDir, "public", "について"), "utf8");
    expect(html).toBe("<h1>ok</h1>");
  }, 30_000);

  it("is reachable on a running server", async () => {
    const outDir = join(tmpDir, "standard");
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    const nitro = await createNitro({
      rootDir: fixtureDir,
      preset: "standard",
      output: { dir: outDir },
      builder: "vite",
    });
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }

    const entry = join(outDir, "server/index.mjs");
    const { fetch } = await import(entry).then((m) => m.default);

    // Requests the literal Unicode path, exactly as a browser navigation would send it.
    const response = await fetch(new Request(`http://localhost${route}`));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<h1>ok</h1>");
  }, 30_000);
});
