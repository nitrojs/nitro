import { afterAll, describe, expect, it } from "vitest";
import { join } from "pathe";
import { tmpdir } from "node:os";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import {
  getRequireConditionNames,
  resolveRequireCallPath,
} from "../../src/build/rolldown/require-condition.ts";

describe("resolveRequireCallPath", () => {
  const tmpDirs: string[] = [];

  afterAll(async () => {
    await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("prefers require condition for require-call package resolution", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "nitro-rolldown-require-condition-"));
    tmpDirs.push(rootDir);

    const pkgDir = join(rootDir, "node_modules/dual-entry");
    await mkdir(join(pkgDir, "esm"), { recursive: true });
    await mkdir(join(pkgDir, "cjs"), { recursive: true });
    await writeFile(
      join(pkgDir, "package.json"),
      JSON.stringify(
        {
          name: "dual-entry",
          version: "0.0.0",
          exports: {
            ".": {
              import: "./esm/index.mjs",
              require: "./cjs/index.cjs",
              default: "./cjs/index.cjs",
            },
          },
        },
        null,
        2
      )
    );
    await writeFile(join(pkgDir, "esm/index.mjs"), "export default { entry: 'esm' };\n");
    await writeFile(join(pkgDir, "cjs/index.cjs"), "module.exports = class DualEntry {};\n");

    const resolved = resolveRequireCallPath({
      id: "dual-entry",
      rootDir,
      conditionNames: getRequireConditionNames(["workerd", "import", "default"]),
    });

    expect(resolved?.replaceAll("\\", "/")).toMatch(/dual-entry\/cjs\/index\.cjs$/);
  });

  it("skips builtins and relative imports", () => {
    const conditionNames = getRequireConditionNames(["workerd", "import", "default"]);
    const rootDir = process.cwd();
    expect(resolveRequireCallPath({ id: "events", rootDir, conditionNames })).toBeUndefined();
    expect(resolveRequireCallPath({ id: "./local", rootDir, conditionNames })).toBeUndefined();
  });
});
