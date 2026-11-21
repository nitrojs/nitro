import { promises as fsp } from "node:fs";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { dirname, join, normalize } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Nitro } from "nitro/types";

import publicAssets from "../../src/build/virtual/public-assets.ts";
import { ENCODING_EXTS as WRITTEN_EXTS } from "../../src/utils/compress.ts";
import { ENCODING_EXTS } from "../../src/runtime/internal/public-assets.ts";
import { readAsset as readNode } from "../../src/runtime/internal/public-assets-node.ts";
import { readAsset as readInline } from "../../src/runtime/internal/public-assets-inline.ts";
import { evalPublicAssets, loadPublicAssets, servedFile } from "./_public-assets.ts";

const manifest = vi.hoisted(() => ({}) as Record<string, object>);
vi.mock("#nitro/virtual/public-assets-data", () => ({ default: manifest }));

function setManifest(assets: Record<string, object>) {
  for (const id in manifest) {
    delete manifest[id];
  }
  Object.assign(manifest, assets);
}

// Simulated runtime layout of a built bundle.
const SERVER_MAIN = "file:///app/server/index.ts";
const PUBLIC_DIR = "/app/public";

describe("public assets node reader", () => {
  let readFile: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    (globalThis as any).__nitro_main__ = SERVER_MAIN;
    // Manifest key is the decoded id (`/%2e%2e/...`); the stored path still points at the
    // literal on-disk file inside `public/` (`%252e%252e`), never the server bundle.
    setManifest({
      "/index.html": { path: "../public/index.html" },
      "/%2e%2e/server/index.ts": { path: "../public/%252e%252e/server/index.ts" },
    });
    readFile = vi.spyOn(fsp, "readFile").mockResolvedValue(new Uint8Array() as any);
  });
  afterEach(() => {
    delete (globalThis as any).__nitro_main__;
    vi.restoreAllMocks();
  });
  const lastRead = () => normalize(readFile.mock.lastCall![0] as string);

  it("serves a normal public asset from within public/", async () => {
    await readNode("/index.html");
    expect(lastRead()).toBe(`${PUBLIC_DIR}/index.html`);
  });

  // The node reader reads `assets[id].path` (a build-time validated, public-relative
  // path), never the decoded `id`. So even a manifest key that looks like a `..`
  // traversal resolves to its real on-disk file inside public/, never the server bundle.
  it("reads via the manifest path, so a traversal-looking key stays inside public/", async () => {
    await readNode("/%2e%2e/server/index.ts");
    expect(lastRead().startsWith(`${PUBLIC_DIR}/`)).toBe(true);
    expect(lastRead()).not.toBe("/app/server/index.ts");
  });

  // A public dir pruned after the build (uploaded to a CDN, sourcemaps stripped)
  // leaves manifest entries with no file behind them; those read as absent so the
  // static middleware can answer 404 rather than surfacing an unhandled 500.
  it("resolves with no data when the file is gone", async () => {
    readFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    await expect(readNode("/index.html")).resolves.toBeUndefined();
  });

  it("rejects for read errors other than a missing file", async () => {
    readFile.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }));
    await expect(readNode("/index.html")).rejects.toThrow("EACCES");
  });

  it("streams only the requested range of a file", async () => {
    vi.restoreAllMocks();
    const dir = await mkdtemp(join(tmpdir(), "nitro-read-range-"));
    try {
      await mkdir(join(dir, "public"));
      await writeFile(join(dir, "public/file.bin"), "0123456789");
      (globalThis as any).__nitro_main__ = pathToFileURL(join(dir, "server/index.mjs")).href;
      setManifest({
        "/file.bin": { path: "../public/file.bin" },
        "/gone.bin": { path: "../gone" },
      });

      const stream = await readNode("/file.bin", { range: { start: 2, end: 4 } });
      expect(stream).toBeInstanceOf(ReadableStream);
      expect(await new Response(stream as ReadableStream).text()).toBe("234");
      await expect(readNode("/gone.bin", { range: { start: 0, end: 1 } })).resolves.toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reads the compressed copy of an encoding", async () => {
    await readNode("/index.html", { encoding: "br" });
    expect(lastRead()).toBe(`${PUBLIC_DIR}/index.html.br`);
    await readNode("/index.html", { encoding: "zstd" });
    expect(lastRead()).toBe(`${PUBLIC_DIR}/index.html.zst`);
  });
});

describe("virtual/public-assets without serveStatic", () => {
  it("matches file ids and public asset bases", () => {
    const { isPublicAssetURL } = evalPublicAssets(
      { serveStatic: false, publicAssets: [{ baseURL: "/_nuxt" }] },
      { ids: new Set(["/foo.css", "/foo.css.br"]) }
    );
    expect(isPublicAssetURL("/foo.css")).toBe(true);
    expect(isPublicAssetURL("/foo.css.br")).toBe(true);
    expect(isPublicAssetURL("/_nuxt/missing.js")).toBe(true);
    expect(isPublicAssetURL("/foo.css.gz")).toBe(false);
    expect(isPublicAssetURL("/api/hello")).toBe(false);
  });

  it("selects the reader of serveStatic", () => {
    const code = (serveStatic: unknown) =>
      (
        publicAssets({
          options: { serveStatic, baseURL: "/", publicAssets: [] },
        } as unknown as Nitro).find((t) => t.id === "#nitro/virtual/public-assets")!
          .template as () => string
      )();
    expect(code(true)).toContain(`from '#nitro/runtime/public-assets-node'`);
    expect(code("node")).toContain(`from '#nitro/runtime/public-assets-node'`);
    expect(code("inline")).toContain(`from '#nitro/runtime/public-assets-inline'`);
    expect(code(false)).not.toContain("#nitro/runtime/");
  });
});

describe("public assets inline reader", () => {
  beforeEach(() => {
    setManifest({
      "/a.txt": { data: btoa("plain"), variants: { br: { data: btoa("br") } } },
      "/b.txt": { variants: { gzip: { data: btoa("gzip") } } },
      "/empty.txt": { data: "" },
    });
  });
  const text = (data: Uint8Array | undefined) => data && new TextDecoder().decode(data);

  it("reads the data of the plain file or of a variant", () => {
    expect(text(readInline("/a.txt"))).toBe("plain");
    expect(text(readInline("/a.txt", { encoding: "br" }))).toBe("br");
    expect(text(readInline("/b.txt", { encoding: "gzip" }))).toBe("gzip");
    expect(readInline("/empty.txt")).toEqual(new Uint8Array());
    expect(readInline("/a.txt", { encoding: "gzip" })).toBeUndefined();
    expect(readInline("/b.txt")).toBeUndefined();
    expect(readInline("/missing.txt")).toBeUndefined();
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
    "/docs/",
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

  const ALL = ["br", "gzip", "zstd", ""];
  it.each([
    ["/foo.css", ALL, "/foo.css.br"],
    ["/foo.css", ["gzip", "br", ""], "/foo.css.gz"],
    ["/foo.css", ["zstd", ""], undefined],
    ["/foo.css.br", ALL, "/foo.css.br"],
    ["/bar.js", ALL, "/bar.js.zst"],
    ["/robots.txt", ALL, "/robots.txt"],
    ["/", ALL, "/index.html"],
    ["/docs", ALL, "/docs/index.html"],
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
    ["/bar.js", ["x-unknown", "constructor", ""], undefined],
  ])("resolves %s for %j to %s", (id, encodings, expected) => {
    expect(servedFile(resolveAsset(id, encodings))).toBe(expected);
  });

  it.each([
    ["/foo.css", true],
    ["/bar.js", true],
    ["/blog", true],
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

  // The build writes the copies, the runtime reads them: their tables are kept in sync
  it("serves the copies the build writes", () => {
    expect({ ...ENCODING_EXTS }).toEqual({ ...WRITTEN_EXTS });
  });

  it.each(Object.entries(ENCODING_EXTS))("resolves a %s copy by its own name", (_, ext) => {
    const copies = loadPublicAssets({ "/foo.txt": asset, [`/foo.txt${ext}`]: asset });
    expect(copies.hasAsset(`/foo.txt${ext}`)).toBe(true);
    expect(servedFile(copies.resolveAsset(`/foo.txt${ext}`, [""]))).toBe(`/foo.txt${ext}`);
  });

  it("resolves a root that only exists compressed", () => {
    const root = loadPublicAssets({ "/index.html.br": asset });
    expect(root.hasAsset("/")).toBe(true);
    expect(servedFile(root.resolveAsset("/", ALL))).toBe("/index.html.br");
    expect(root.resolveAsset("/", [""])).toBeUndefined();
  });

  it("treats unknown ids under a public asset base as public", () => {
    expect(isPublicAssetURL("/_nuxt/missing.js")).toBe(true);
    expect(isPublicAssetURL("/robots.txt")).toBe(true);
    expect(isPublicAssetURL("/api/hello")).toBe(false);
  });

  // Presets call it with the raw pathname: it matches files, as named in the public dir
  it("matches compressed copies by their own name with isPublicAssetURL", () => {
    expect(isPublicAssetURL("/foo.css.br")).toBe(true);
    expect(isPublicAssetURL("/blog/index.html.br")).toBe(true);
    expect(isPublicAssetURL("/foo.css")).toBe(false);
    expect(isPublicAssetURL("/blog/index.html")).toBe(false);
    expect(isPublicAssetURL("/foo.css.zst")).toBe(false);
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

  async function buildManifest(
    files: Record<string, string>,
    serveStatic: Nitro["options"]["serveStatic"],
    logger?: { warn: (message: string) => void }
  ) {
    const outDir = await mkdtemp(join(tmpdir(), "nitro-public-assets-"));
    tempDirs.push(outDir);
    const publicDir = join(outDir, "public");
    for (const [name, content] of Object.entries(files)) {
      await mkdir(dirname(join(publicDir, name)), { recursive: true });
      await writeFile(join(publicDir, name), content);
      await utimes(join(publicDir, name), MTIME, name === "foo.css.gz" ? LATER : MTIME);
    }
    const nitro = {
      options: {
        dev: false,
        baseURL: "/",
        serveStatic,
        publicAssets: [],
        output: { publicDir, serverDir: join(outDir, "server") },
      },
      logger,
    } as unknown as Nitro;
    const template = publicAssets(nitro).find((t) => t.id === "#nitro/virtual/public-assets-data")!
      .template as () => Promise<string>;
    return template();
  }

  const MTIME = new Date("2024-01-01T00:00:00.000Z");
  const LATER = new Date("2024-01-02T00:00:00.000Z");
  const FILES = {
    "foo.css": "plain",
    "foo.css.br": "br",
    "foo.css.gz": "gzip",
    "docs/index.html.br": "br",
    "a b.txt": "text",
  };

  it("folds compressed copies into the entry of their plain file", async () => {
    const code = await buildManifest(FILES, true);
    const manifest = JSON.parse(code.replace(/^export default |;$/g, ""));
    expect(manifest).toEqual({
      "/a b.txt": {
        type: "text/plain; charset=utf-8",
        etag: expect.any(String),
        mtime: MTIME.toJSON(),
        size: 4,
        path: "../public/a b.txt",
      },
      "/docs/index.html": {
        type: "text/html; charset=utf-8",
        path: "../public/docs/index.html",
        variants: { br: { etag: expect.any(String), mtime: MTIME.toJSON(), size: 2 } },
      },
      "/foo.css": {
        type: "text/css; charset=utf-8",
        etag: expect.any(String),
        mtime: MTIME.toJSON(),
        size: 5,
        path: "../public/foo.css",
        variants: {
          br: { etag: expect.any(String), size: 2 },
          gzip: { etag: expect.any(String), size: 4 },
        },
      },
    });
    expect(manifest["/foo.css"].variants.br.etag).not.toBe(manifest["/foo.css"].etag);
  });

  it("inlines the data of compressed copies", async () => {
    const code = await buildManifest(FILES, "inline");
    const manifest = JSON.parse(code.replace(/^export default |;$/g, ""));
    expect(manifest["/foo.css"].data).toBe(btoa("plain"));
    expect(manifest["/foo.css"].variants.gzip.data).toBe(btoa("gzip"));
  });

  it("lists only the file ids without serveStatic", async () => {
    const code = await buildManifest(FILES, false);
    expect(code).toBe(
      `export default new Set(${JSON.stringify(
        ["/a b.txt", "/docs/index.html.br", "/foo.css", "/foo.css.br", "/foo.css.gz"],
        null,
        2
      )});`
    );
  });

  it("keeps files named only like an encoding extension as plain files", async () => {
    const code = await buildManifest({ ".gz": "a", "docs/.br": "b", "docs/index.html": "c" }, true);
    const manifest = JSON.parse(code.replace(/^export default |;$/g, ""));
    expect(Object.keys(manifest)).toEqual(["/.gz", "/docs/.br", "/docs/index.html"]);
    expect(manifest["/.gz"]).toMatchObject({ path: "../public/.gz", size: 1 });
    expect(manifest["/.gz"].variants).toBeUndefined();
    expect(manifest["/docs/index.html"].variants).toBeUndefined();
  });

  it("serves one file per id when file names decode to the same id", async () => {
    const warn = vi.fn();
    const code = await buildManifest(
      { "a b.txt.gz": "gzip", "a%20b.txt": "encoded", "a%20b.txt.br": "br" },
      true,
      { warn }
    );
    const manifest = JSON.parse(code.replace(/^export default |;$/g, ""));
    // `a b.txt` sorts first but has no plain file: `a%20b.txt` and its copies are served, unmixed
    expect(manifest).toEqual({
      "/a b.txt": {
        type: "text/plain; charset=utf-8",
        etag: expect.any(String),
        mtime: MTIME.toJSON(),
        size: 7,
        path: "../public/a%20b.txt",
        variants: { br: { etag: expect.any(String), size: 2 } },
      },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("`a b.txt` (`a b.txt.gz`) is not served: `a%20b.txt`")
    );
  });

  it("serves the first file by name when file names decode to the same id", async () => {
    const warn = vi.fn();
    const code = await buildManifest(
      { "a b.txt": "text", "a%20b.txt": "encoded", "a%20b.txt.br": "br" },
      true,
      { warn }
    );
    const manifest = JSON.parse(code.replace(/^export default |;$/g, ""));
    expect(manifest["/a b.txt"]).toMatchObject({ path: "../public/a b.txt", size: 4 });
    expect(manifest["/a b.txt"].variants).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("`a%20b.txt` (`a%20b.txt`, `a%20b.txt.br`) is not served: `a b.txt`")
    );
  });
});
