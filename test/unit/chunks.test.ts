import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "pathe";
import { rolldown, type OutputChunk } from "rolldown";
import { describe, expect, it } from "vitest";
import type { Nitro } from "nitro/types";
import {
  NODE_MODULES_RE,
  libChunkName,
  libChunksGroup,
  pathToPkgName,
  getChunkName,
  routeToFsPath,
} from "../../src/build/chunks.ts";

function createChunk(name: string, moduleIds: string[]): { name: string; moduleIds: string[] } {
  return { name, moduleIds };
}

function createNitro(overrides: Partial<Nitro> = {}): Nitro {
  return {
    options: { buildDir: "/build", tasks: {}, experimental: {}, ...overrides.options },
    routing: {
      routes: { routes: [] },
      ...overrides.routing,
    },
    ...overrides,
  } as unknown as Nitro;
}

describe("NODE_MODULES_RE", () => {
  it.each([
    ["/foo/node_modules/bar/index.js", true],
    ["node_modules/bar/index.js", true],
    ["node_modules\\bar\\index.js", true],
    ["/foo/node_modules/nitro/dist/index.js", false],
    ["/foo/node_modules/nitro-nightly/dist/index.js", false],
    ["/foo/node_modules/.nitro", false],
    ["/foo/node_modules/.cache", false],
    ["/foo/src/bar.js", false],
  ])("%s → %s", (path, expected) => {
    expect(NODE_MODULES_RE.test(path)).toBe(expected);
  });
});

describe("pathToPkgName", () => {
  it.each([
    ["/foo/node_modules/express/index.js", "express"],
    ["/foo/node_modules/@h3/core/index.js", "@h3/core"],
    ["C:\\proj\\node_modules\\express\\index.js", "express"],
    ["C:\\proj\\node_modules\\@h3\\core\\index.js", "@h3\\core"],
    ["/node_modules/nitro-nightly/dist/index.js", "nitro"],
    ["/node_modules/a/node_modules/b/index.js", "b"],
    ["/foo/src/bar.js", undefined],
  ])("%s → %s", (path, expected) => {
    expect(pathToPkgName(path)).toBe(expected);
  });
});

describe("libChunkName", () => {
  it.each([
    ["/node_modules/express/index.js", "_libs/express"],
    ["/node_modules/@h3/core/index.js", "_libs/@h3/core"],
    ["/src/utils/foo.ts", undefined],
    ["/node_modules/nitro-nightly/dist/index.js", "_libs/nitro"],
  ])("%s → %s", (id, expected) => {
    expect(libChunkName(id)).toBe(expected);
  });
});

describe("libChunksGroup", () => {
  it("has a non-enumerable debugName", () => {
    const group = libChunksGroup(createNitro());
    expect(group.test).toBe(NODE_MODULES_RE);
    expect(group.name("/node_modules/express/index.js")).toBe("_libs/express");
    expect((group as { debugName?: string }).debugName).toBe("libs");
    expect(Object.keys(group)).toEqual(["test", "name", "entriesAware"]);
    expect(group.entriesAware).toBe(true);
  });

  it("can opt out of entriesAware with experimental.entriesAwareLibChunks", () => {
    const nitro = createNitro();
    nitro.options.experimental.entriesAwareLibChunks = false;
    expect(libChunksGroup(nitro).entriesAware).toBe(false);
  });

  it.each([
    ["keeps a lazy chunk's packages out of the entry's imports", undefined, ["small"]],
    [
      "loads a lazy chunk's packages from the entry when opted out",
      false as const,
      ["small", "big"],
    ],
  ])("%s", async (_, entriesAwareLibChunks, expected) => {
    const nitro = createNitro();
    nitro.options.experimental.entriesAwareLibChunks = entriesAwareLibChunks;
    const dir = mkdtempSync(join(tmpdir(), "nitro-lib-chunks-"));
    const files = {
      "node_modules/small/package.json": `{ "name": "small", "type": "module", "main": "index.js" }`,
      "node_modules/small/index.js": `export const small = "small";`,
      "node_modules/big/package.json": `{ "name": "big", "type": "module", "main": "index.js" }`,
      "node_modules/big/index.js": `import { small } from "small"; export const big = small + "-big";`,
      "entry.mjs": `import { small } from "small"; export default [small, () => import("./lazy.mjs")];`,
      "lazy.mjs": `import { big } from "big"; export default big;`,
    };
    try {
      for (const [path, code] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), code);
      }
      const bundle = await rolldown({ input: join(dir, "entry.mjs"), cwd: dir });
      const { output } = await bundle.generate({
        format: "esm",
        chunkFileNames: (chunk) => getChunkName(chunk, nitro),
        codeSplitting: { groups: [libChunksGroup(nitro)] },
      });
      const chunks = new Map(output.map((chunk) => [chunk.fileName, chunk]));
      const loaded = new Set<string>();
      const load = (fileName: string) => {
        const chunk = chunks.get(fileName);
        if (chunk?.type !== "chunk" || loaded.has(fileName)) return;
        loaded.add(fileName);
        chunk.imports.forEach(load);
      };
      const entry = output.find((item) => item.type === "chunk" && item.isEntry);
      expect(entry).toBeDefined();
      load(entry!.fileName);
      const packages = [...loaded].flatMap((fileName) =>
        Object.keys((chunks.get(fileName) as OutputChunk).modules).map((id) => pathToPkgName(id))
      );
      expect(packages.filter(Boolean).sort()).toEqual([...expected].sort());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("routeToFsPath", () => {
  it.each([
    ["/api/hello", "api/hello"],
    ["/api/users/:id", "api/users/[id]"],
    ["/", "index"],
    ["/api/users/:id/posts/*", "api/users/[id]/posts/[...]"],
    ["/api/files/:path(.*)", "api/files/[...path]"],
  ])("%s → %s", (route, expected) => {
    expect(routeToFsPath(route)).toBe(expected);
  });
});

describe("getChunkName", () => {
  const nitro = createNitro();

  it.each<[string, { name: string; moduleIds: string[] }, string]>([
    ["rolldown-runtime", createChunk("rolldown-runtime", []), "_runtime.mjs"],
    ["_ chunks are preserved", createChunk("_shared", ["/src/foo.ts"]), "_shared.mjs"],
    [
      "~ in non-library chunk names is preserved",
      createChunk("_shared~index~api-hello", ["/src/foo.ts"]),
      "_shared~index~api-hello.mjs",
    ],
    [
      "entriesAware library subgroup with non-library modules keeps the group name",
      createChunk("_libs/foo~index~api-hello", ["/node_modules/foo/index.js", "/src/foo.ts"]),
      "_libs/foo.mjs",
    ],
    [
      "entriesAware library subgroup keeps the group name",
      createChunk("_libs/vendor~index~x1y2z3", [
        "/node_modules/some-very-long-package-name/index.js",
        "/node_modules/another-very-long-name/index.js",
      ]),
      "_libs/vendor+[...].mjs",
    ],
    [
      "all node_modules (sorted a-z)",
      createChunk("vendor", ["/node_modules/express/index.js", "/node_modules/h3/dist/index.mjs"]),
      "_libs/express+h3.mjs",
    ],
    [
      "single node_modules package",
      createChunk("vendor", ["/node_modules/a/index.js"]),
      "_libs/a.mjs",
    ],
    [
      "node_modules names exceed 30 chars",
      createChunk("_libs/vendor", [
        "/node_modules/some-very-long-package-name/index.js",
        "/node_modules/another-very-long-name/index.js",
      ]),
      "_libs/vendor+[...].mjs",
    ],
    [
      "3 node_modules sorted a-z",
      createChunk("vendor", [
        "/node_modules/zod/index.js",
        "/node_modules/ab/index.js",
        "/node_modules/h3/dist/index.mjs",
      ]),
      "_libs/ab+h3+zod.mjs",
    ],
    [
      "scoped packages use __ separator",
      createChunk("vendor", ["/node_modules/@h3/core/index.js", "/node_modules/defu/index.js"]),
      "_libs/defu+h3__core.mjs",
    ],
    ["empty moduleIds (vacuous every())", createChunk("my-chunk", []), "_libs/_.mjs"],
    [
      "virtual:raw modules",
      createChunk("raw", ["\0virtual:raw:foo", "#virtual:raw:bar"]),
      "_raw/[name].mjs",
    ],
    ["all virtual modules", createChunk("virt", ["\0something", "#other"]), "_virtual/[name].mjs"],
    ["wasm modules", createChunk("wasm", ["/src/module.wasm"]), "_wasm/[name].mjs"],
    [
      "vite/services modules",
      createChunk("ssr", ["/vite/services/component.js"]),
      "_ssr/[name].mjs",
    ],
    ["buildDir modules", createChunk("build", ["/build/generated.js"]), "_build/[name].mjs"],
    [
      "mixed virtual + wasm",
      createChunk("mixed", ["\0virtual:something", "/src/module.wasm"]),
      "_wasm/[name].mjs",
    ],
    ["fallback to _chunks", createChunk("misc", ["/src/utils/helper.ts"]), "_chunks/[name].mjs"],
  ])("%s → %s", (_label, chunk, expected) => {
    expect(getChunkName(chunk, nitro)).toBe(expected);
  });

  it("returns _routes/<path>.mjs for route handler", () => {
    const n = createNitro({
      routing: {
        routes: {
          routes: [{ data: [{ route: "/api/hello", handler: "/src/routes/api/hello.ts" }] }],
        },
      },
    } as any);
    expect(getChunkName(createChunk("route", ["/src/routes/api/hello.ts"]), n)).toBe(
      "_routes/api/hello.mjs"
    );
  });

  it.each([
    ["rolldown", "_routes/api/users/[id].mjs"],
    ["rollup", "_routes/api/users/%5Bid%5D.mjs"],
  ])("returns _routes/<path>.mjs for dynamic route (%s)", (builder, expected) => {
    const n = createNitro({
      options: { builder },
      routing: {
        routes: {
          routes: [
            {
              data: [{ route: "/api/users/:id", handler: "/src/routes/api/users/[id].ts" }],
            },
          ],
        },
      },
    } as any);
    expect(getChunkName(createChunk("route", ["/src/routes/api/users/[id].ts"]), n)).toBe(expected);
  });

  it.each([
    ["rolldown", "_routes/api/applications/[id]/context.mjs"],
    ["rollup", "_routes/api/applications/%5Bid%5D/context.mjs"],
  ])("returns _routes/<path>.mjs for nested dynamic route (%s)", (builder, expected) => {
    const n = createNitro({
      options: { builder },
      routing: {
        routes: {
          routes: [
            {
              data: [
                {
                  route: "/api/applications/:id/context",
                  handler: "/src/routes/api/applications/[id]/context.ts",
                },
              ],
            },
          ],
        },
      },
    } as any);
    expect(
      getChunkName(createChunk("route", ["/src/routes/api/applications/[id]/context.ts"]), n)
    ).toBe(expected);
  });

  it("returns _routes/index.mjs for root route", () => {
    const n = createNitro({
      routing: {
        routes: {
          routes: [{ data: [{ route: "/", handler: "/src/routes/index.ts" }] }],
        },
      },
    } as any);
    expect(getChunkName(createChunk("route", ["/src/routes/index.ts"]), n)).toBe(
      "_routes/index.mjs"
    );
  });

  it("returns _tasks/[name].mjs for task handler", () => {
    const n = createNitro({
      options: {
        buildDir: "/build",
        tasks: { "db:migrate": { handler: "/src/tasks/migrate.ts" } },
      },
    } as any);
    expect(getChunkName(createChunk("task", ["/src/tasks/migrate.ts"]), n)).toBe(
      "_tasks/[name].mjs"
    );
  });
});
