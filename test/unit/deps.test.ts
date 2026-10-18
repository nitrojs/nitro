import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { readPackageJSON } from "pkg-types";
import { minVersion, satisfies, subset } from "semver";
import { describe, expect, it, vi } from "vitest";
import { deps } from "../../src/utils/_deps.ts";
import type { DepId, DepMeta } from "../../src/utils/_deps.ts";
import * as dep from "../../src/utils/dep.ts";

vi.mock("../../src/utils/dep.ts", () => ({ importDep: vi.fn(async () => ({})) }));

const rootDir = new URL("../../", import.meta.url);

const pkg = await readPackageJSON(fileURLToPath(rootDir));

/** Whether the version range the tests run against is within `range`. */
function isTestedVersion(id: string, range: string): boolean {
  const tested = pkg.devDependencies?.[id];
  return !!tested && satisfies(minVersion(tested)!, range, { includePrerelease: true });
}

describe("dependency manifest", () => {
  it.each(Object.keys(deps) as DepId[])("`%s` range covers the tested version", (id) => {
    expect(isTestedVersion(id, deps[id].version)).toBe(true);
  });

  it("runtime dependencies are installed as dependencies without prompting", () => {
    for (const meta of Object.values(deps) as DepMeta[]) {
      if (meta.runtime) {
        expect(meta).toMatchObject({ dev: false, autoInstall: true });
      }
    }
  });
});

describe("shimmed dependencies", async () => {
  const c12 = await readPackageJSON("c12", { url: rootDir.href });
  const shims = (await readdir(new URL("src/shims/", rootDir)))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => file.slice(0, -".ts".length));

  it.each(shims)("`%s` range is within the one of the bundled library", async (id) => {
    await import(`../../src/shims/${id}.ts`);
    const opts = vi.mocked(dep.importDep).mock.calls.find(([opts]) => opts.id === id)?.[0];
    expect(opts?.version).toBeTypeOf("string");
    expect(id in deps).toBe(false);
    const peerRange = c12.peerDependencies?.[id];
    expect(peerRange).toBeTypeOf("string");
    expect(subset(opts!.version!, peerRange!, { includePrerelease: true })).toBe(true);
    expect(isTestedVersion(id, opts!.version!)).toBe(true);
  });
});
