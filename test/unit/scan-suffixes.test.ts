import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scanPlugins, scanServerRoutes, scanTasks } from "../../src/scan.ts";
import type { Nitro } from "nitro/types";

let dir: string;

function write(...paths: string[]) {
  for (const path of paths) {
    const fullPath = join(dir, path);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, "export default {}");
  }
}

const nitro = (options: Record<string, unknown> = {}) =>
  ({
    options: { scanDirs: [dir], ignore: [], ...options },
    logger: { error: vi.fn(), warn: vi.fn() },
  }) as unknown as Nitro;

const routes = async (n = nitro()) =>
  (await scanServerRoutes(n, "routes")).map((r) => [r.route, r.method, r.env].filter(Boolean));

describe("scan suffixes", () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nitro-scan-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("parses method and env suffixes", async () => {
    write(
      "routes/a.get.ts",
      "routes/b.prod.ts",
      "routes/c/index.post.dev.ts",
      "routes/[id].get.ts"
    );
    expect(await routes()).toEqual([
      ["/:id", "get"],
      ["/a", "get"],
      ["/b", "prod"],
      ["/c", "post", "dev"],
    ]);
  });

  it("keeps known file extensions and custom suffixes", async () => {
    write(
      "routes/sitemap.xml.ts",
      "routes/docs/[slug].md.get.ts",
      "routes/v1.2.ts",
      "routes/page.mdx2.ts",
      "routes/hello.world.ts",
      "routes/[...].ts"
    );
    expect(await routes(nitro({ scanSuffixes: ["world"] }))).toEqual([
      ["/**"],
      ["/docs/:slug.md", "get"],
      ["/hello.world"],
      ["/page.mdx2"],
      ["/sitemap.xml"],
      ["/v1.2"],
    ]);
  });

  it("throws on unknown suffixes", async () => {
    write("routes/hello.world.ts");
    await expect(routes()).rejects.toThrow("Unknown suffix `.world` in `routes/hello.world.ts`");
  });

  it("keeps method and env words before the parsed suffixes", async () => {
    write("routes/foo.get.get.ts", "routes/bar.dev.post.ts");
    expect(await routes()).toEqual([
      ["/bar.dev", "post"],
      ["/foo.get", "get"],
    ]);
  });

  it("reserves env suffixes in plugins and tasks", async () => {
    write("plugins/log.dev.ts", "tasks/db/seed.prod.ts");
    await expect(scanPlugins(nitro())).rejects.toThrow("not supported in `plugins/`");
    await expect(scanTasks(nitro())).rejects.toThrow("not supported in `tasks/`");
  });

  it("logs and skips invalid files in dev", async () => {
    write("routes/ok.ts", "routes/hello.world.ts");
    const n = nitro({ dev: true });
    expect(await routes(n)).toEqual([["/ok"]]);
    expect(n.logger.error).toHaveBeenCalledOnce();
  });

  it("ignores test files and type declarations", async () => {
    write(
      "routes/ok.ts",
      "routes/ok.test.ts",
      "routes/ok.get.spec.ts",
      "routes/types.d.ts",
      "plugins/log.ts",
      "plugins/log.test.ts"
    );
    expect(await routes()).toEqual([["/ok"]]);
    expect((await scanPlugins(nitro())).map((p) => p.slice(dir.length + 1))).toEqual([
      "plugins/log.ts",
    ]);
  });
});
