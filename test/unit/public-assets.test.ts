import { fileURLToPath } from "node:url";
import { dirname, resolve } from "pathe";
import { describe, expect, it } from "vitest";
import type { Nitro } from "nitropack/types";
import { publicAssets } from "../../src/rollup/plugins/public-assets";

const ASSETS: Record<string, { path: string }> = {
  "/index.html": { path: "../public/index.html" },
};

// Return the `node` reader source, asserting `serveStatic: true` (used by all
// node-based presets) routes to it.
function nodeReaderTemplate(): string {
  const vfs: Record<string, any> = {};
  publicAssets({
    options: { serveStatic: true, publicAssets: [] },
    vfs,
  } as unknown as Nitro);
  expect(vfs["#nitro-internal-virtual/public-assets"]()).toContain(
    `from "#nitro-internal-virtual/public-assets-node"`
  );
  return vfs["#nitro-internal-virtual/public-assets-node"]();
}

// Evaluate the generated `readAsset` template with a stubbed `fs`.
function loadReadAsset(readFile: () => Promise<unknown>) {
  const fsp = { readFile };
  // Strip the (single-line) imports and bridge their bindings in as args instead.
  const body = nodeReaderTemplate()
    .replace(/^\s*import\s.*$/gm, "")
    .replace(/export\s+function/, "function")
    .replaceAll("import.meta.url", "__serverMain");
  return new Function(
    "fsp",
    "fileURLToPath",
    "resolve",
    "dirname",
    "assets",
    "__serverMain",
    `${body}\nreturn readAsset;`
  )(
    fsp,
    fileURLToPath,
    resolve,
    dirname,
    ASSETS,
    "file:///app/server/index.mjs"
  ) as (id: string) => Promise<unknown>;
}

describe("virtual/public-assets node reader", () => {
  // A public dir pruned after the build (uploaded to a CDN, sourcemaps stripped)
  // leaves manifest entries with no file behind them; those read as absent so the
  // static middleware can answer 404 rather than surfacing an unhandled 500.
  it("resolves with no data when the file is gone", async () => {
    const readAsset = loadReadAsset(() =>
      Promise.reject(
        Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" })
      )
    );

    await expect(readAsset("/index.html")).resolves.toBeUndefined();
  });

  it("rejects for read errors other than a missing file", async () => {
    const readAsset = loadReadAsset(() =>
      Promise.reject(
        Object.assign(new Error("EACCES: permission denied"), {
          code: "EACCES",
        })
      )
    );

    await expect(readAsset("/index.html")).rejects.toThrow("EACCES");
  });
});
