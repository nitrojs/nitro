import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "pathe";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Nitro, NitroOptions } from "nitro/types";

import { generateFunctionFiles } from "../../src/presets/vercel/utils.ts";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

const SERVER_FILES = [
  "index.mjs",
  "index.mjs.map",
  "node_modules/big-native/index.js",
  "node_modules/big-native/bin/native.node",
  "node_modules/big-native/package.json",
  "node_modules/.nf3/multi@1.0.0/index.js",
  "node_modules/.nf3/multi@2.0.0/index.js",
  "node_modules/kept/index.js",
  "node_modules/kept/lib/addon.node",
];

async function build(options: Partial<NitroOptions> & { handlerRoutes?: string[] }) {
  const dir = await mkdtemp(join(tmpdir(), "nitro-vercel-exclude-files-"));
  dirs.push(dir);
  const serverDir = join(dir, "functions/__server.func");
  for (const file of SERVER_FILES) {
    await mkdir(dirname(join(serverDir, file)), { recursive: true });
    await writeFile(join(serverDir, file), file);
  }
  await symlink("./.nf3/multi@1.0.0", join(serverDir, "node_modules/multi"));
  await mkdir(join(serverDir, "node_modules/big-native/empty"));
  const warn = vi.fn();
  const nitro = {
    _prerenderedRoutes: [],
    scannedHandlers: (options.handlerRoutes || []).map((route) => ({ route, handler: "" })),
    logger: { warn },
    options: {
      baseURL: "/",
      static: false,
      framework: { name: "nitro", version: "3.x" },
      experimental: {},
      publicAssets: [],
      handlers: [],
      output: { dir, serverDir },
      routeRules: {},
      ...options,
    },
  } as unknown as Nitro;
  await generateFunctionFiles(nitro);
  const exists = (func: string, file: string) =>
    lstat(join(dir, "functions", func, file)).then(
      () => true,
      () => false
    );
  const vcConfig = (func: string) =>
    readFile(join(dir, "functions", func, ".vc-config.json"), "utf8").then(JSON.parse);
  const isSymlink = (func: string) =>
    lstat(join(dir, "functions", func)).then((stat) => stat.isSymbolicLink());
  return { exists, isSymlink, vcConfig, warn };
}

describe("vercel excludeFiles", () => {
  it("applies base and per-rule exclusions to each function", async () => {
    const { exists, isSymlink, vcConfig, warn } = await build({
      handlerRoutes: ["/flow", "/light", "/other"],
      vercel: {
        functions: { maxDuration: 60, excludeFiles: ["node_modules/big-native/**"] },
        functionRules: {
          // Arrays replace the base value, so `[]` keeps every file
          "/flow": { maxDuration: "max", excludeFiles: [] },
          "/light": {
            excludeFiles: ["node_modules/big-*", "!node_modules/big-native/package.json", "*.map"],
          },
        },
      },
    });

    expect(await exists("__server.func", "index.mjs")).toBe(true);
    expect(await exists("__server.func", "index.mjs.map")).toBe(true);
    expect(await exists("__server.func", "node_modules/kept/index.js")).toBe(true);
    expect(await exists("__server.func", "node_modules/big-native")).toBe(false);

    expect(await exists("flow.func", "node_modules/big-native/bin/native.node")).toBe(true);

    expect(await exists("light.func", "index.mjs")).toBe(true);
    expect(await exists("light.func", "index.mjs.map")).toBe(false);
    expect(await exists("light.func", "node_modules/big-native/package.json")).toBe(true);
    expect(await exists("light.func", "node_modules/big-native/index.js")).toBe(false);
    expect(await exists("light.func", "node_modules/big-native/bin")).toBe(false);

    // Observability functions are symlinks to the base function
    expect(await isSymlink("other.func")).toBe(true);
    expect(await exists("other.func", "node_modules/big-native")).toBe(false);

    for (const func of ["__server.func", "flow.func", "light.func"]) {
      expect(await vcConfig(func)).not.toHaveProperty("excludeFiles");
    }
    expect((await vcConfig("flow.func")).maxDuration).toBe("max");
    expect((await vcConfig("light.func")).maxDuration).toBe(60);
    expect(warn).not.toHaveBeenCalled();
  });

  it("applies rule exclusions to ISR and wildcard rule functions", async () => {
    const { exists, isSymlink } = await build({
      handlerRoutes: ["/api/foo", "/page"],
      routeRules: { "/page": { isr: 60 } },
      vercel: {
        functions: { excludeFiles: "node_modules/big-native/**" },
        functionRules: {
          "/api/**": { excludeFiles: ["*.map"] },
          "/page": { excludeFiles: ["node_modules/kept/**"] },
        },
      },
    });
    expect(await isSymlink("api/foo.func")).toBe(false);
    expect(await exists("api/foo.func", "index.mjs.map")).toBe(false);
    expect(await exists("api/foo.func", "node_modules/big-native/index.js")).toBe(true);
    expect(await exists("page-isr.func", "node_modules/kept")).toBe(false);
    expect(await exists("page-isr.func", "node_modules/big-native/index.js")).toBe(true);
  });

  it("tracks patterns matching inside an excluded directory", async () => {
    const { exists, warn } = await build({
      vercel: { functions: { excludeFiles: ["node_modules/**", "**/*.node"] } },
    });
    expect(await exists("__server.func", "node_modules")).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it("treats a leading extglob as a pattern, not a negation", async () => {
    const { exists } = await build({
      vercel: { functions: { excludeFiles: "!(index.mjs|node_modules)" } },
    });
    expect(await exists("__server.func", "index.mjs")).toBe(true);
    expect(await exists("__server.func", "index.mjs.map")).toBe(false);
    expect(await exists("__server.func", "node_modules/kept/index.js")).toBe(true);
  });

  it("removes matching symlinks without following them", async () => {
    const { exists } = await build({
      vercel: { functions: { excludeFiles: "node_modules/multi/**" } },
    });
    expect(await exists("__server.func", "node_modules/multi")).toBe(false);
    expect(await exists("__server.func", "node_modules/.nf3/multi@1.0.0/index.js")).toBe(true);
  });

  it("removes multi-version dependencies through their `.nf3` path", async () => {
    const { exists } = await build({
      vercel: { functions: { excludeFiles: "node_modules/{,.nf3/}multi*/**" } },
    });
    expect(await exists("__server.func", "node_modules/multi")).toBe(false);
    expect(await exists("__server.func", "node_modules/.nf3")).toBe(false);
    expect(await exists("__server.func", "node_modules/kept/index.js")).toBe(true);
  });

  it("never removes `.vc-config.json`", async () => {
    const { vcConfig } = await build({
      vercel: { functions: { excludeFiles: "**/*.json" } },
    });
    expect((await vcConfig("__server.func")).handler).toBe("index.mjs");
  });

  it("warns once for patterns that match nothing", async () => {
    const { warn } = await build({
      handlerRoutes: ["/a", "/b"],
      vercel: {
        functions: { excludeFiles: ["node_modules/typo/**"] },
        functionRules: { "/a": {}, "/b": {} },
      },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("node_modules/typo/**");
  });

  it("refuses to remove the function handler", async () => {
    await expect(build({ vercel: { functions: { excludeFiles: "**/*.mjs" } } })).rejects.toThrow(
      "matches the function handler `index.mjs`"
    );
    await expect(
      build({
        handlerRoutes: ["/a"],
        vercel: {
          functionRules: { "/a": { handler: "server/index.mjs", excludeFiles: "server" } },
        },
      })
    ).rejects.toThrow("matches the function handler `server/index.mjs`");
    const { exists } = await build({
      vercel: { functions: { excludeFiles: ["*.mjs*", "!index.mjs"] } },
    });
    expect(await exists("__server.func", "index.mjs")).toBe(true);
    expect(await exists("__server.func", "index.mjs.map")).toBe(false);
  });

  it("rejects patterns outside of the function directory", async () => {
    await expect(
      build({ vercel: { functions: { excludeFiles: "../__server.func/index.mjs" } } })
    ).rejects.toThrow("cannot leave it");
    await expect(build({ vercel: { functions: { excludeFiles: "/etc/**" } } })).rejects.toThrow(
      "cannot leave it"
    );
    await expect(build({ vercel: { functions: { excludeFiles: "" } } })).rejects.toThrow(
      "Invalid empty"
    );
  });
});
