import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scanModules, scanPlugins } from "../../src/scan.ts";
import type { Nitro } from "nitro/types";

let dir: string;

function write(path: string, contents = "export default {}") {
  const fullPath = join(dir, path);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, contents);
}

const nitro = () =>
  ({
    options: { scanDirs: [dir], ignore: [] },
    logger: console,
  }) as unknown as Nitro;

const rel = (files: string[]) => files.map((f) => f.slice(dir.length + 1)).sort();

describe("scanModules", () => {
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "nitro-scan-"));
    write("modules/log/index.ts");
    write("modules/log/runtime/routes/log.ts");
    write("modules/log/utils.ts");
    write("modules/inline.ts");
    write("modules/nested/deep/index.ts");
    write("plugins/nested/plugin.ts");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("only registers `modules/*.ts` and `modules/*/index.ts`", async () => {
    expect(rel(await scanModules(nitro()))).toEqual(["modules/inline.ts", "modules/log/index.ts"]);
  });

  it("still scans other dirs recursively", async () => {
    expect(rel(await scanPlugins(nitro()))).toEqual(["plugins/nested/plugin.ts"]);
  });
});
