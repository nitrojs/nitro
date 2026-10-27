import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import alias from "@rollup/plugin-alias";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { rollup } from "rollup";
import { defineEnv } from "unenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveAliases } from "../../src/rollup/utils";

describe("rollup aliases", () => {
  let root: string;
  let empty: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "nitro-aliases-"));
    empty = join(root, "empty.mjs");
    await writeFile(empty, "export {};");
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function bundle(idToImport: string, aliases: Record<string, string>) {
    const entry = join(root, "entry.mjs");
    return rollup({
      input: entry,
      plugins: [
        {
          name: "entry",
          resolveId: (id) => (id === entry ? id : null),
          load: (id) =>
            id === entry
              ? `export * from ${JSON.stringify(idToImport)};`
              : null,
        },
        alias({ entries: resolveAliases(aliases) }),
        nodeResolve({
          exportConditions: ["workerd"],
          modulePaths: [
            fileURLToPath(new URL("../../node_modules", import.meta.url)),
          ],
        }),
      ],
      onwarn(warning) {
        throw new Error(warning.message);
      },
    });
  }

  it.each([
    ["node-fetch-native", "/dist/native.mjs"],
    ["node-fetch-native/native", "/dist/native.mjs"],
    ["node-fetch-native/proxy", "/dist/proxy-stub.mjs"],
    ["node-fetch-native/polyfill", "empty.mjs"],
  ])("resolves %s with workerd exports", async (id, expected) => {
    // Match the fetch resolver overrides after unenv resolves package entries.
    const { env } = defineEnv({
      resolve: true,
      overrides: {
        alias: {
          "node-fetch-native": "node-fetch-native/native",
          "node-fetch-native/native": "node-fetch-native/native",
          "node-fetch-native/polyfill": empty,
        },
      },
    });
    const build = await bundle(id, env.alias);
    try {
      expect(build.watchFiles.some((file) => file.endsWith(expected))).toBe(
        true
      );
      expect(
        build.watchFiles.some((file) => file.includes("native.mjs/"))
      ).toBe(false);
    } finally {
      await build.close();
    }
  });

  it("preserves directory prefixes, alias ordering, and escaped exact matches", () => {
    const entries = resolveAliases({
      "pkg.name": empty,
      "pkg.name/special": root,
      "#root": root,
      "#file": "#root/empty.mjs",
    });
    const packageEntry = entries.find((entry) => entry.replacement === empty)!;
    expect(packageEntry.find).toBeInstanceOf(RegExp);
    expect("pkg.name".match(packageEntry.find)).toBeTruthy();
    expect("pkgXname".match(packageEntry.find)).toBeNull();
    expect("pkg.name/proxy".match(packageEntry.find)).toBeNull();
    expect(
      entries.find((entry) => entry.find === "pkg.name/special")?.replacement
    ).toBe(root);
    expect(
      entries.findIndex((entry) => entry.find === "pkg.name/special")
    ).toBeLessThan(entries.indexOf(packageEntry));
    expect(
      entries.find(
        (entry) => entry.find instanceof RegExp && entry.find.test("#file")
      )?.replacement
    ).toBe(empty);
  });

  it("resolves imports through directory aliases", async () => {
    const build = await bundle("directory/empty.mjs", { directory: root });
    try {
      expect(build.watchFiles).toContain(empty);
    } finally {
      await build.close();
    }
  });

  it.each(["unavailable", "missing"])(
    "reports an unmatched %s export",
    async (subpath) => {
      const pkg = join(root, "node_modules/conditional-pkg");
      await mkdir(pkg, { recursive: true });
      await writeFile(
        join(pkg, "package.json"),
        JSON.stringify({
          name: "conditional-pkg",
          exports: {
            ".": { workerd: "./index.mjs" },
            "./unavailable": { custom: "./index.mjs" },
          },
        })
      );
      await writeFile(join(pkg, "index.mjs"), "export {};");
      await expect(
        bundle(`conditional-pkg/${subpath}`, {
          "conditional-pkg": join(pkg, "index.mjs"),
        })
      ).rejects.toThrow(
        /Could not resolve import "conditional-pkg\/.*".*using exports/
      );
    }
  );
});
