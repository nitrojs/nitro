import * as nodeFsp from "node:fs/promises";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, normalize, resolve } from "pathe";
import { afterEach, describe, expect, it } from "vitest";
import type { Nitro } from "nitro/types";

import publicAssets from "../../src/build/virtual/public-assets.ts";
import { loadPublicAssets } from "./_public-assets.ts";

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
function loadReadAsset(
  template: string,
  readFile?: () => Promise<unknown>,
  { fs, main = SERVER_MAIN, assets = ASSETS }: { fs?: unknown; main?: string; assets?: object } = {}
) {
  const reads: string[] = [];
  const fsp = fs ?? {
    readFile: (p: string | URL) => {
      reads.push(typeof p === "string" ? p : fileURLToPath(p));
      return readFile ? readFile() : Promise.resolve(new Uint8Array());
    },
  };
  // Strip the (single-line) imports and bridge their bindings in as args instead.
  const body = template.replace(/^\s*import\s.*$/gm, "").replace(/export\s+function/, "function");
  (globalThis as any).__nitro_main__ = main;
  const readAsset = new Function(
    "fsp",
    "Readable",
    "fileURLToPath",
    "resolve",
    "dirname",
    "assets",
    `${body}\nreturn readAsset;`
  )(fsp, Readable, fileURLToPath, resolve, dirname, assets) as (
    id: string,
    range?: { start: number; end: number }
  ) => Promise<unknown>;
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

  it("streams only the requested range of a file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nitro-read-range-"));
    try {
      await mkdir(join(dir, "public"));
      await writeFile(join(dir, "public/file.bin"), "0123456789");
      const { readAsset } = loadReadAsset(nodeReaderTemplate(), undefined, {
        fs: nodeFsp,
        main: pathToFileURL(join(dir, "server/index.mjs")).href,
        assets: { "/file.bin": { path: "../public/file.bin" }, "/gone.bin": { path: "../gone" } },
      });

      const stream = await readAsset("/file.bin", { start: 2, end: 4 });
      expect(stream).toBeInstanceOf(ReadableStream);
      expect(await new Response(stream as ReadableStream).text()).toBe("234");
      await expect(readAsset("/gone.bin", { start: 0, end: 1 })).resolves.toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("virtual/public-assets lookup", () => {
  const asset = { type: "text/plain", etag: "", mtime: "", size: 1, path: "" };
  const { hasAsset, resolveAsset, hasEncodedVariants, isPublicAssetURL, isPublicAssetBaseURL } =
    loadPublicAssets(
      Object.fromEntries(
        [
          "/index.html",
          "/robots.txt",
          "/foo.css.gz",
          "/foo.css.br",
          "/bar.js.zst",
          "/archive.tgz",
          "/docs/index.html",
          "/blog/index.html.br",
          "/page",
          "/page/index.html",
          "/page/index.html.gz",
          "/a.gz",
          "/a.gz.br",
          "/a b/ü.txt",
          "/_nuxt/entry.js",
        ].map((id) => [id, asset])
      ),
      { publicAssets: [{ baseURL: "/_nuxt" }] }
    );

  it.each([
    "/index.html",
    "/",
    "/robots.txt",
    "/foo.css",
    "/foo.css.gz",
    "/foo.css.br",
    "/bar.js",
    "/docs",
    "/docs/",
    "/docs/index.html",
    "/blog",
    "/blog/index.html",
    "/blog/index.html.br",
    "/a b/ü.txt",
    "/_nuxt/entry.js",
  ])("has %s", (id) => {
    expect(hasAsset(id)).toBe(true);
  });

  it.each([
    "/api/hello",
    "/foo",
    "/foo.css.gz.gz",
    "/archive.",
    "/robots.txt/index.html",
    "/doc",
    "/docs/index",
    "/a%20b/%C3%BC.txt",
    "/_nuxt/missing.js",
    "",
  ])("does not have %s", (id) => {
    expect(hasAsset(id)).toBe(false);
  });

  const ALL = [".br", ".gz", ".zst", ""];
  it.each([
    ["/foo.css", ALL, "/foo.css.br"],
    ["/foo.css", [".gz", ".br", ""], "/foo.css.gz"],
    ["/foo.css", [".zst", ""], undefined],
    ["/foo.css.br", ALL, "/foo.css.br"],
    ["/bar.js", ALL, "/bar.js.zst"],
    ["/robots.txt", ALL, "/robots.txt"],
    ["/", ALL, "/index.html"],
    ["/docs", ALL, "/docs/index.html"],
    ["/docs/", ALL, "/docs/index.html"],
    ["/blog", ALL, "/blog/index.html.br"],
    ["/blog", [""], undefined],
    ["/blog/index.html", ALL, "/blog/index.html.br"],
    // A file named like the request wins over its `index.html`, for the same encoding
    ["/page", [""], "/page"],
    ["/page", ALL, "/page/index.html.gz"],
    ["/api/hello", ALL, undefined],
    ["/foo.css/", ALL, undefined],
    // A user-shipped compressed file is a plain file with its own variants
    ["/a", ALL, "/a.gz"],
    ["/a.gz", ALL, "/a.gz.br"],
    ["/a.gz", [""], "/a.gz"],
    ["/bar.js", ["x-unknown", ""], undefined],
  ])("resolves %s for %j to %s", (id, encodings, expected) => {
    expect(resolveAsset(id, encodings)).toBe(expected);
  });

  it.each([
    ["/foo.css", true],
    ["/bar.js", true],
    ["/blog", true],
    ["/blog/", true],
    ["/blog/index.html", true],
    ["/page", true],
    ["/a", true],
    ["/a.gz", true],
    ["/foo.css.br", false],
    ["/robots.txt", false],
    ["/", false],
    ["/docs", false],
    ["/archive.tgz", false],
    ["/api/hello", false],
    ["/_nuxt/missing.js", false],
  ])("has encoded variants for %s: %s", (id, expected) => {
    expect(hasEncodedVariants(id)).toBe(expected);
  });

  it("resolves a root that only exists compressed", () => {
    const root = loadPublicAssets({ "/index.html.br": asset });
    expect(root.hasAsset("/")).toBe(true);
    expect(root.resolveAsset("/", ALL)).toBe("/index.html.br");
    expect(root.resolveAsset("/", [""])).toBeUndefined();
  });

  it("treats unknown ids under a public asset base as public", () => {
    expect(isPublicAssetURL("/_nuxt/missing.js")).toBe(true);
    expect(isPublicAssetURL("/robots.txt")).toBe(true);
    expect(isPublicAssetURL("/api/hello")).toBe(false);
  });

  it("matches only public asset bases with isPublicAssetBaseURL", () => {
    expect(isPublicAssetBaseURL("/_nuxt/missing.js")).toBe(true);
    expect(isPublicAssetBaseURL("/_nuxt/entry.js")).toBe(true);
    expect(isPublicAssetBaseURL("/robots.txt")).toBe(false);
    expect(isPublicAssetBaseURL("/api/hello")).toBe(false);
  });
});

describe("public assets manifest", () => {
  const tempDirs: string[] = [];
  afterEach(async () => {
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("lists assets in the same order on every build", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "nitro-public-assets-"));
    tempDirs.push(outDir);
    const publicDir = join(outDir, "public");
    // Large files first, so reads finish out of name order
    const names = Array.from({ length: 40 }, (_, i) => `f${String(i).padStart(2, "0")}.txt`);
    await mkdir(publicDir, { recursive: true });
    for (const [i, name] of names.entries()) {
      await writeFile(join(publicDir, name), "x".repeat((names.length - i) * 20_000));
    }
    const nitro = {
      options: {
        dev: false,
        baseURL: "/",
        serveStatic: true,
        publicAssets: [],
        output: { publicDir, serverDir: join(outDir, "server") },
      },
    } as unknown as Nitro;
    const template = publicAssets(nitro).find((t) => t.id === "#nitro/virtual/public-assets-data")!
      .template as () => Promise<string>;
    const keys = (code: string) =>
      Object.keys(JSON.parse(code.replace(/^export default |;$/g, "")));
    expect(keys(await template())).toEqual(names.map((name) => `/${name}`));
  });
});
