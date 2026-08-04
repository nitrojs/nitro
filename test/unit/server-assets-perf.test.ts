import {
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "pathe";
import { describe, expect, it } from "vitest";
import { createNitro, build, prepare, copyPublicAssets } from "nitropack/core";
import { listen } from "listhen";

const ROOT = join(import.meta.dirname, ".tmp-server-assets-perf");
const DATA = join(ROOT, "i18n-data");

function genTree(dir: string, depth: number, branch: number): number {
  mkdirSync(dir, { recursive: true });
  if (depth === 0) {
    writeFileSync(
      join(dir, "data.json"),
      JSON.stringify({ v: 1, s: "x".repeat(200) })
    );
    return 1;
  }
  let n = 0;
  for (let i = 0; i < branch; i++) {
    n += genTree(join(dir, `l${i}`), depth - 1, branch);
  }
  return n;
}

function countRawMjs(outDir: string): number {
  const rawDir = join(outDir, "server/chunks/raw");
  if (!existsSync(rawDir)) {
    return 0;
  }
  let n = 0;
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        walk(join(d, e.name));
      } else if (e.name.endsWith(".mjs")) {
        n++;
      }
    }
  };
  walk(rawDir);
  return n;
}

async function buildWithAssets(
  outName: string,
  serverAssets: {
    baseName: string;
    dir: string;
    embed?: boolean | "inline";
    pattern?: string;
    ignore?: string[];
  }[],
  handlers?: { route: string; handler: string }[]
) {
  const outDir = join(ROOT, outName);
  rmSync(outDir, { recursive: true, force: true });
  const t0 = performance.now();
  // node-listener exports `listener` without auto-listen (node-server binds :3000 on import).
  const nitro = await createNitro({
    rootDir: ROOT,
    srcDir: ROOT,
    output: { dir: outDir },
    preset: "node-listener",
    minify: false,
    typescript: { generateTsConfig: false },
    logging: { compressedSizes: false },
    serverAssets,
    handlers,
  });
  await prepare(nitro);
  await copyPublicAssets(nitro);
  await build(nitro);
  return { outDir, ms: performance.now() - t0 };
}

describe("serverAssets large catalogs", () => {
  // depth=4, branch=5 → 625 JSON files
  const fileCount = (() => {
    rmSync(ROOT, { recursive: true, force: true });
    return genTree(DATA, 4, 5);
  })();

  // Tiny mixed fixture for runtime / binary / ignore tests
  const MIX = join(ROOT, "mixed");
  mkdirSync(join(MIX, "txt"), { recursive: true });
  writeFileSync(join(MIX, "txt", "hello.json"), JSON.stringify({ ok: true }));
  writeFileSync(join(MIX, "txt", "skip.me"), "nope");
  writeFileSync(
    join(MIX, "txt", "pixel.bin"),
    Buffer.from([0x00, 0x01, 0x02, 0xff])
  );

  const handlerPath = join(ROOT, "routes", "read.get.ts");
  mkdirSync(join(ROOT, "routes"), { recursive: true });
  writeFileSync(
    handlerPath,
    `export default defineEventHandler(async (event) => {
  const id = getQuery(event).id as string
  const storage = useStorage('assets:i18n')
  const item = await storage.getItem(id)
  return {
    has: await storage.hasItem(id),
    // JSON-safe: Uint8Array → number[] (binary inline path)
    item: item instanceof Uint8Array ? Array.from(item) : item,
    meta: await storage.getMeta(id),
    keys: await storage.getKeys(),
  }
})
`
  );

  it("generates hundreds of fixture files", () => {
    expect(fileCount).toBe(625);
  });

  it(
    "omit embed ≡ historical one raw: chunk per file (default unchanged)",
    { timeout: 120_000 },
    async () => {
      const { outDir } = await buildWithAssets("out-raw", [
        { baseName: "i18n", dir: DATA },
      ]);
      expect(countRawMjs(outDir)).toBe(fileCount);
      // Default template path: no fs mounts / no _inline bag
      const entry = readFileSync(join(outDir, "server/index.mjs"), "utf8");
      // Virtual assets land in chunks — spot-check no assets/ copy for default
      expect(existsSync(join(outDir, "server/assets/i18n"))).toBe(false);
      void entry;
    }
  );

  it(
    "embed:true explicit matches omit (same raw: count)",
    { timeout: 120_000 },
    async () => {
      const { outDir } = await buildWithAssets("out-raw-explicit", [
        { baseName: "i18n", dir: join(MIX, "txt"), embed: true },
      ]);
      // 3 files in MIX/txt (hello.json, skip.me, pixel.bin)
      expect(countRawMjs(outDir)).toBe(3);
      expect(existsSync(join(outDir, "server/assets"))).toBe(false);
    }
  );

  it(
    "embed:false copies assets, skips raw:, and serves getItem at runtime",
    { timeout: 120_000 },
    async () => {
      const { outDir } = await buildWithAssets(
        "out-fs",
        [{ baseName: "i18n", dir: DATA, embed: false }],
        [{ route: "/read", handler: handlerPath }]
      );
      expect(countRawMjs(outDir)).toBe(0);
      expect(
        existsSync(join(outDir, "server/assets/i18n/l0/l0/l0/l0/data.json"))
      ).toBe(true);

      const { listener } = await import(join(outDir, "server/index.mjs"));
      const server = await listen(listener, { port: 0 });
      try {
        const url = `${server.url}read?id=${encodeURIComponent("l0/l0/l0/l0/data.json")}`;
        const res = await fetch(url).then((r) => r.json());
        expect(res.has).toBe(true);
        expect(res.item).toMatchObject({ v: 1 });
        expect(res.meta?.type).toMatch(/json/);
        expect(res.keys.length).toBeGreaterThanOrEqual(fileCount);
      } finally {
        await server.close();
      }
    }
  );

  it(
    "embed:'inline' has no raw: chunks and returns JSON + meta",
    { timeout: 120_000 },
    async () => {
      const { outDir, ms } = await buildWithAssets(
        "out-inline",
        [{ baseName: "i18n", dir: join(MIX, "txt"), embed: "inline" }],
        [{ route: "/read", handler: handlerPath }]
      );
      expect(countRawMjs(outDir)).toBe(0);
      expect(ms).toBeLessThan(15_000);

      const { listener } = await import(join(outDir, "server/index.mjs"));
      const server = await listen(listener, { port: 0 });
      try {
        const res = await fetch(
          `${server.url}read?id=${encodeURIComponent("hello.json")}`
        ).then((r) => r.json());
        expect(res.has).toBe(true);
        // Inline text may be string or already-parsed depending on unstorage
        const item =
          typeof res.item === "string" ? JSON.parse(res.item) : res.item;
        expect(item).toEqual({ ok: true });
        expect(res.meta?.etag).toBeTruthy();
        expect(res.meta?.mtime).toBeTruthy();
      } finally {
        await server.close();
      }
    }
  );

  it(
    "embed:'inline' preserves binary bytes",
    { timeout: 60_000 },
    async () => {
      const { outDir } = await buildWithAssets(
        "out-inline-bin",
        [{ baseName: "i18n", dir: join(MIX, "txt"), embed: "inline" }],
        [{ route: "/read", handler: handlerPath }]
      );
      const { listener } = await import(join(outDir, "server/index.mjs"));
      const server = await listen(listener, { port: 0 });
      try {
        const res = await fetch(
          `${server.url}read?id=${encodeURIComponent("pixel.bin")}`
        ).then((r) => r.json());
        expect(res.has).toBe(true);
        const expected = readFileSync(join(MIX, "txt", "pixel.bin"));
        expect(Array.isArray(res.item)).toBe(true);
        expect(Buffer.from(res.item)).toEqual(expected);
      } finally {
        await server.close();
      }
    }
  );

  it(
    "embed:'inline' respects ignore patterns",
    { timeout: 60_000 },
    async () => {
      const { outDir } = await buildWithAssets(
        "out-inline-ignore",
        [
          {
            baseName: "i18n",
            dir: join(MIX, "txt"),
            embed: "inline",
            ignore: ["**/skip.me"],
          },
        ],
        [{ route: "/read", handler: handlerPath }]
      );
      const { listener } = await import(join(outDir, "server/index.mjs"));
      const server = await listen(listener, { port: 0 });
      try {
        const res = await fetch(
          `${server.url}read?id=${encodeURIComponent("skip.me")}`
        ).then((r) => r.json());
        expect(res.has).toBe(false);
        expect(res.keys).not.toContain("skip.me");
        expect(res.keys.some((k: string) => k.includes("hello.json"))).toBe(
          true
        );
      } finally {
        await server.close();
      }
    }
  );

  it(
    "default raw: path still serves getItem at runtime",
    { timeout: 60_000 },
    async () => {
      const { outDir } = await buildWithAssets(
        "out-raw-runtime",
        [{ baseName: "i18n", dir: join(MIX, "txt") }],
        [{ route: "/read", handler: handlerPath }]
      );
      expect(countRawMjs(outDir)).toBe(3);
      const { listener } = await import(join(outDir, "server/index.mjs"));
      const server = await listen(listener, { port: 0 });
      try {
        const res = await fetch(
          `${server.url}read?id=${encodeURIComponent("hello.json")}`
        ).then((r) => r.json());
        expect(res.has).toBe(true);
        const item =
          typeof res.item === "string" ? JSON.parse(res.item) : res.item;
        expect(item).toEqual({ ok: true });
        expect(res.meta?.type).toMatch(/json/);
        expect(res.meta?.etag).toBeTruthy();
      } finally {
        await server.close();
      }
    }
  );

  it(
    "embed:'inline' respects pattern",
    { timeout: 60_000 },
    async () => {
      const { outDir } = await buildWithAssets(
        "out-inline-pattern",
        [
          {
            baseName: "i18n",
            dir: join(MIX, "txt"),
            embed: "inline",
            pattern: "**/*.json",
          },
        ],
        [{ route: "/read", handler: handlerPath }]
      );
      const { listener } = await import(join(outDir, "server/index.mjs"));
      const server = await listen(listener, { port: 0 });
      try {
        const hello = await fetch(
          `${server.url}read?id=${encodeURIComponent("hello.json")}`
        ).then((r) => r.json());
        const bin = await fetch(
          `${server.url}read?id=${encodeURIComponent("pixel.bin")}`
        ).then((r) => r.json());
        expect(hello.has).toBe(true);
        expect(bin.has).toBe(false);
        expect(hello.keys.every((k: string) => k.endsWith(".json"))).toBe(true);
      } finally {
        await server.close();
      }
    }
  );

  it(
    "mixed dirs: embed:false + default raw do not interfere",
    { timeout: 120_000 },
    async () => {
      const small = join(ROOT, "small-raw");
      mkdirSync(small, { recursive: true });
      writeFileSync(join(small, "a.json"), JSON.stringify({ a: 1 }));

      const { outDir } = await buildWithAssets("out-mixed", [
        { baseName: "disk", dir: DATA, embed: false },
        { baseName: "bundled", dir: small },
      ]);
      expect(existsSync(join(outDir, "server/assets/disk"))).toBe(true);
      expect(countRawMjs(outDir)).toBe(1);
    }
  );
});

