import { readdir } from "node:fs/promises";
import { consola } from "consola";
import { fileURLToPath } from "node:url";
import { readPackageJSON } from "pkg-types";
import { minVersion, satisfies, subset } from "semver";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { NitroOptions } from "nitro/types";
import { resolveDepsOptions } from "../../src/config/resolvers/deps.ts";
import { deps, shims } from "../../src/utils/_deps.ts";
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
    expect(isTestedVersion(id, deps[id].version), "run `pnpm sync-deps`").toBe(true);
  });

  it("infers the module type of `importDep` from the id", () => {
    expectTypeOf(dep.importDep({ id: "rollup", dir: "" })).resolves.toEqualTypeOf<
      typeof import("rollup")
    >();
    expectTypeOf(dep.importDep({ id: "db0", dir: "" })).resolves.toEqualTypeOf<
      typeof import("db0")
    >();
    // @ts-expect-error a dependency missing from the manifest requires a `reason`
    void dep.importDep({ id: "not-in-manifest", dir: "" });
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
  const shimFiles = (await readdir(new URL("src/shims/", rootDir)))
    .filter((file) => file.endsWith(".ts") && !file.startsWith("_"))
    .map((file) => file.slice(0, -".ts".length));

  it("are listed in the manifest", () => {
    expect([...shimFiles].sort()).toEqual(Object.keys(shims).sort());
  });

  it.each(shimFiles)("`%s` range is within the one of the bundled library", async (id) => {
    await import(`../../src/shims/${id}.ts`);
    const opts = vi.mocked(dep.importDep).mock.calls.find(([opts]) => opts.id === id)?.[0];
    expect(opts?.version).toBe(shims[id as keyof typeof shims].version);
    expect(id in deps).toBe(false);
    const library = await readPackageJSON(shims[id as keyof typeof shims].library, {
      url: rootDir.href,
    });
    const peerRange = library.peerDependencies?.[id];
    expect(peerRange).toBeTypeOf("string");
    expect(subset(opts!.version!, peerRange!, { includePrerelease: true })).toBe(true);
    expect(isTestedVersion(id, opts!.version!)).toBe(true);
  });
});

describe("`deps` option", () => {
  it("aliases `vite.path` and `deps.paths.vite`", () => {
    const fromVitePath = { vite: { path: "/vite" } } as unknown as NitroOptions;
    resolveDepsOptions(fromVitePath);
    expect(fromVitePath.deps?.paths?.vite).toBe("/vite");

    const fromDeps = { deps: { paths: { vite: "/vite" } } } as unknown as NitroOptions;
    resolveDepsOptions(fromDeps);
    expect(fromDeps.vite?.path).toBe("/vite");
  });

  it("prefers `deps.paths.vite` over a different `vite.path` (with a warning)", () => {
    const warn = vi.spyOn(consola, "warn").mockImplementation(() => {});
    const options = {
      vite: { path: "/vite-a" },
      deps: { paths: { vite: "/vite-b" } },
    } as unknown as NitroOptions;
    resolveDepsOptions(options);
    expect(options.vite?.path).toBe("/vite-b");
    expect(options.deps?.paths?.vite).toBe("/vite-b");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Using `deps.paths.vite`"));
    warn.mockRestore();
  });
});
