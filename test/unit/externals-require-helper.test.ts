import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { dirname, join } from "pathe";
import { pkgDir } from "#nitro/meta";
import { afterAll, describe, expect, it } from "vitest";
import { build, createNitro, prepare } from "../../src/builder.ts";

// Rolldown places its runtime (and the `__require` helper) in the only chunk
// that uses it, here `_libs/pkg-cjs.mjs`, or in `index.mjs` when inlined.
// The doc comment mimics an import of the helper from another chunk.
const appFiles = {
  "package.json": JSON.stringify({ type: "module" }),
  "server.ts": [
    `import lib from "@fixture/lib";`,
    `import pkg from "pkg-cjs";`,
    `export default { fetch: () => Response.json({ lib, nested: pkg.lib }) };`,
  ].join("\n"),
  "node_modules/@fixture/lib/package.json": JSON.stringify({
    name: "@fixture/lib",
    version: "1.0.0",
    main: "./index.js",
  }),
  "node_modules/@fixture/lib/index.js": `module.exports = "@fixture/lib@1.0.0";`,
  "node_modules/pkg-cjs/package.json": JSON.stringify({
    name: "pkg-cjs",
    version: "1.0.0",
    type: "module",
    exports: "./index.js",
    dependencies: { "@fixture/lib": "2.0.0" },
  }),
  "node_modules/pkg-cjs/index.js": [
    `import lib from "./lib.cjs";`,
    `/** Emits code like: import { __require } from "./_shared/runtime.mjs" */`,
    `export default { lib };`,
  ].join("\n"),
  "node_modules/pkg-cjs/lib.cjs": `module.exports = require("@fixture/lib");`,
  "node_modules/pkg-cjs/node_modules/@fixture/lib/package.json": JSON.stringify({
    name: "@fixture/lib",
    version: "2.0.0",
    main: "./index.js",
  }),
  "node_modules/pkg-cjs/node_modules/@fixture/lib/index.js": `module.exports = "@fixture/lib@2.0.0";`,
};

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("externals: traced require() from the rolldown runtime chunk", () => {
  it.each([false, true])("inlineDynamicImports: %s", async (inlineDynamicImports) => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-externals-require-"));
    tmpDirs.push(rootDir);
    for (const [path, contents] of Object.entries(appFiles)) {
      mkdirSync(dirname(join(rootDir, path)), { recursive: true });
      writeFileSync(join(rootDir, path), contents);
    }
    symlinkSync(pkgDir, join(rootDir, "node_modules/nitro"), "junction");
    const nitro = await createNitro({
      rootDir,
      builder: "rolldown",
      preset: "standard",
      traceDeps: ["@fixture"],
      inlineDynamicImports,
      logLevel: 0,
    });
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }
    const entry = join(nitro.options.output.serverDir, "index.mjs");
    const { default: server } = await import(pathToFileURL(entry).href);
    const res = await server.fetch(new Request("http://localhost/"));
    expect(await res.json()).toEqual({ lib: "@fixture/lib@1.0.0", nested: "@fixture/lib@2.0.0" });
  });
});
