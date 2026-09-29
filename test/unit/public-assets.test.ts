import { fileURLToPath } from "node:url";
import { dirname, normalize, resolve } from "pathe";
import { afterEach, describe, expect, it } from "vitest";
import type { Nitro } from "nitro/types";

import publicAssets from "../../src/build/virtual/public-assets.ts";

// Simulated runtime layout of a built bundle.
const SERVER_MAIN = "file:///app/server/index.ts";
const PUBLIC_DIR = "/app/public";

// Crafted manifest mirroring the prerender/manifest decode chain:
// a real (attacker-plantable) public file whose decoded id looks like a `..` traversal.
// `path` is always the build-time, validated, manifest-relative path to a real file inside `public/`.
const ASSETS: Record<string, { path: string }> = {
  "/index.html": { path: "../public/index.html" },
  // Manifest key is the decoded id (`/%2e%2e/...`); the stored path still points at the
  // literal on-disk file inside `public/` (`%252e%252e`), never the server bundle.
  "/%2e%2e/server/index.ts": { path: "../public/%252e%252e/server/index.ts" },
};

// Return the `node` reader source, asserting the production selection logic in
// `#nitro/virtual/public-assets` routes `serveStatic: true` (used by all node-based
// presets) to it.
function nodeReaderTemplate(): string {
  const nitro = {
    options: { serveStatic: true, baseURL: "/", publicAssets: [] },
  } as unknown as Nitro;
  const templates = publicAssets(nitro);
  const main = (
    templates.find((t) => t.id === "#nitro/virtual/public-assets")!.template as () => string
  )();
  expect(main).toContain(`from "#nitro/virtual/public-assets-node"`);

  const reader = templates.find((t) => t.id === "#nitro/virtual/public-assets-node")?.template;
  if (typeof reader !== "function") {
    throw new Error("node reader template not found");
  }
  return reader() as string;
}

// Evaluate the generated `readAsset` template against the real node helpers it
// imports, recording the filesystem target it asks `fs` to read.
function loadReadAsset(template: string, readFile?: () => Promise<unknown>) {
  const reads: string[] = [];
  const fsp = {
    readFile: (p: string | URL) => {
      reads.push(typeof p === "string" ? p : fileURLToPath(p));
      return readFile ? readFile() : Promise.resolve(new Uint8Array());
    },
  };
  // Strip the (single-line) imports and bridge their bindings in as args instead.
  const body = template.replace(/^\s*import\s.*$/gm, "").replace(/export\s+function/, "function");
  (globalThis as any).__nitro_main__ = SERVER_MAIN;
  const readAsset = new Function(
    "fsp",
    "fileURLToPath",
    "resolve",
    "dirname",
    "assets",
    `${body}\nreturn readAsset;`
  )(fsp, fileURLToPath, resolve, dirname, ASSETS) as (id: string) => Promise<unknown>;
  return { readAsset, reads };
}

describe("virtual/public-assets node reader", () => {
  afterEach(() => {
    delete (globalThis as any).__nitro_main__;
  });

  it("serves a normal public asset from within public/", async () => {
    const { readAsset, reads } = loadReadAsset(nodeReaderTemplate());
    await readAsset("/index.html");
    expect(normalize(reads.at(-1)!)).toBe(`${PUBLIC_DIR}/index.html`);
  });

  // The node reader reads `assets[id].path` (a build-time validated, public-relative
  // path), never the decoded `id`. So even a manifest key that looks like a `..`
  // traversal resolves to its real on-disk file inside public/, never the server bundle.
  it("reads via the manifest path, so a traversal-looking key stays inside public/", async () => {
    const { readAsset, reads } = loadReadAsset(nodeReaderTemplate());
    await readAsset("/%2e%2e/server/index.ts");
    const resolved = normalize(reads.at(-1)!);
    expect(resolved.startsWith(`${PUBLIC_DIR}/`)).toBe(true);
    expect(resolved).not.toBe("/app/server/index.ts");
  });

  // A public dir pruned after the build (uploaded to a CDN, sourcemaps stripped)
  // leaves manifest entries with no file behind them; those read as absent so the
  // static middleware can answer 404 rather than surfacing an unhandled 500.
  it("resolves with no data when the file is gone", async () => {
    const { readAsset } = loadReadAsset(nodeReaderTemplate(), () =>
      Promise.reject(Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }))
    );

    await expect(readAsset("/index.html")).resolves.toBeUndefined();
  });

  it("rejects for read errors other than a missing file", async () => {
    const { readAsset } = loadReadAsset(nodeReaderTemplate(), () =>
      Promise.reject(Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" }))
    );

    await expect(readAsset("/index.html")).rejects.toThrow("EACCES");
  });
});

// Return the `#nitro/virtual/public-assets` source for a dev build with the given runner.
function devMainTemplate(runner?: string): string {
  const nitro = {
    options: {
      dev: true,
      serveStatic: true,
      baseURL: "/",
      publicAssets: [{ dir: PUBLIC_DIR, baseURL: "/" }],
      devServer: runner ? { runner } : {},
    },
  } as unknown as Nitro;
  const main = publicAssets(nitro).find((t) => t.id === "#nitro/virtual/public-assets")!
    .template as () => string;
  return main();
}

describe("virtual/public-assets dev template", () => {
  const savedRunner = process.env.NITRO_DEV_RUNNER;
  afterEach(() => {
    if (savedRunner === undefined) {
      delete process.env.NITRO_DEV_RUNNER;
    } else {
      process.env.NITRO_DEV_RUNNER = savedRunner;
    }
  });

  it("resolves assets from the source dirs with node:fs on the default runner", () => {
    delete process.env.NITRO_DEV_RUNNER;
    const main = devMainTemplate();
    expect(main).toContain("from 'node:fs'");
    expect(main).not.toContain("#nitro/virtual/public-assets-data");
  });

  // The workerd-based `miniflare` runner cannot load `node:fs`, so the dev worker
  // must keep the build-time manifest path there.
  it("keeps the manifest path for the miniflare runner", () => {
    delete process.env.NITRO_DEV_RUNNER;
    const main = devMainTemplate("miniflare");
    expect(main).not.toContain("node:fs");
    expect(main).toContain(`from '#nitro/virtual/public-assets-data'`);
  });

  it("honours NITRO_DEV_RUNNER when devServer.runner is unset", () => {
    process.env.NITRO_DEV_RUNNER = "miniflare";
    const main = devMainTemplate();
    expect(main).not.toContain("node:fs");
    expect(main).toContain(`from '#nitro/virtual/public-assets-data'`);
  });
});
