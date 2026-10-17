import { fileURLToPath } from "node:url";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "pathe";
import { describe, expect, test } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";

const fixtureDir = fileURLToPath(new URL("./missing-ssr-entry-fixture", import.meta.url));
const tmpDir = fileURLToPath(new URL("./.tmp/missing-ssr-entry", import.meta.url));

const SSR_ENTRY = `export default {
  fetch() {
    return new Response("<h1>ssr</h1>", { headers: { "content-type": "text/html" } });
  },
};
`;

// The Vite plugin only auto-detects `./entry-server` in `<rootDir|scanDirs>/{app,src,}/` (see
// `setupNitroContext`). Anywhere else no `ssr` service is registered, no renderer is wired up and
// every prerendered route resolves to `404` — which used to exit 0 with an empty output. #4591
async function buildWithSsrEntryAt(name: string, entryPath: string) {
  const rootDir = join(tmpDir, name);
  await rm(rootDir, { recursive: true, force: true });
  await mkdir(rootDir, { recursive: true });
  await cp(fixtureDir, rootDir, { recursive: true });
  await mkdir(join(rootDir, entryPath, ".."), { recursive: true });
  await writeFile(join(rootDir, entryPath), SSR_ENTRY, "utf8");

  const publicDir = join(rootDir, ".output/public");
  const nitro = await createNitro({ rootDir, builder: "vite", prerender: { routes: ["/"] } });
  try {
    await prepare(nitro);
    await build(nitro);
    return { error: undefined, publicDir };
  } catch (error) {
    return { error: error as Error, publicDir };
  } finally {
    await nitro.close();
  }
}

describe("vite: ssr entry outside the auto-detected directories", () => {
  test("fails the build instead of exiting 0 with no html", async () => {
    const { error, publicDir } = await buildWithSsrEntryAt("missing", "src/ssr/entry-server.ts");

    expect(error).toBeDefined();
    expect(String(error?.message)).toContain("Prerendered 0 routes");
    expect(existsSync(join(publicDir, "index.html"))).toBe(false);
  }, 60_000);

  test("prerenders normally when the ssr entry is auto-detected", async () => {
    const { error, publicDir } = await buildWithSsrEntryAt("detected", "src/entry-server.ts");

    expect(error).toBeUndefined();
    expect(existsSync(join(publicDir, "index.html"))).toBe(true);
  }, 60_000);
});
