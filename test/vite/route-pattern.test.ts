import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { rm, mkdir, readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";

import { routes } from "./route-pattern-fixture/nitro.config.ts";

const fixtureDir = fileURLToPath(new URL("./route-pattern-fixture", import.meta.url));
const tmpDir = join(fixtureDir, ".tmp");

async function buildFixture(preset: string) {
  const outDir = join(tmpDir, preset);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const nitro = await createNitro({
    rootDir: fixtureDir,
    preset,
    output: { dir: outDir },
    builder: "vite",
  });
  try {
    await prepare(nitro);
    await build(nitro);
  } finally {
    await nitro.close();
  }
  return outDir;
}

describe("route patterns needing normalization", () => {
  describe("standard preset", () => {
    let fetchServer: (req: Request) => Promise<Response>;

    beforeAll(async () => {
      const outDir = await buildFixture("standard");
      const entry = await import(join(outDir, "server/index.mjs"));
      fetchServer = entry.default.fetch;
    }, 60_000);

    it.each(routes)("serves %j", async (route) => {
      // The literal route text, exactly as a browser navigation would send it.
      const response = await fetchServer(new Request(`http://localhost${route}`));
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("ok");
    });
  });

  it("prerenders a non-ASCII route under its own literal path", async () => {
    const outDir = await buildFixture("static");
    // The handler returns a plain string, so the response is `text/plain` and
    // the route is written verbatim rather than as `について.html`.
    expect(await readFile(join(outDir, "public", "について"), "utf8")).toBe("ok");
  }, 60_000);
});
