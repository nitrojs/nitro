import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "pathe";
import { describe, expect, it } from "vitest";
import { loadOptions } from "../../src/config/loader.ts";
import { resolveNitroPath } from "../../src/utils/fs.ts";

describe("resolveNitroPath aliases", () => {
  it.each([
    ["general first", { "#api": "./api", "#api-admin": "./admin" }],
    ["specific first", { "#api-admin": "./admin", "#api": "./api" }],
  ])("uses the most specific alias with %s", (_name, alias) => {
    const options = { alias, rootDir: "/app/" } as any;

    expect(resolveNitroPath("#api-admin/handler.ts", options)).toBe("/app/admin/handler.ts");
    expect(resolveNitroPath("#api/handler.ts", options)).toBe("/app/api/handler.ts");
  });

  it.each([
    ["general first", { "#api": "./api", "#api/admin": "./admin" }],
    ["specific first", { "#api/admin": "./admin", "#api": "./api" }],
  ])("uses the most specific nested alias with %s", (_name, alias) => {
    const options = { alias, rootDir: "/app/" } as any;

    expect(resolveNitroPath("#api/admin/handler.ts", options)).toBe("/app/admin/handler.ts");
  });

  it.each([
    ["referenced last", { "#a": "#b/x", "#b": "./dir" }],
    ["referenced first", { "#b": "./dir", "#a": "#b/x" }],
  ])("resolves aliases that point to other aliases with %s", (_name, alias) => {
    const options = { alias, rootDir: "/app/" } as any;

    expect(resolveNitroPath("#a/handler.ts", options)).toBe("/app/dir/x/handler.ts");
  });

  it("only matches aliases at a path segment boundary", () => {
    const options = { alias: { "#api": "./api" }, rootDir: "/app/" } as any;

    expect(resolveNitroPath("#api", options)).toBe("/app/api");
    expect(resolveNitroPath("#apifoo/handler.ts", options)).toBe("#apifoo/handler.ts");
  });
});

describe("configured handler aliases", () => {
  it("resolves routes independently of alias insertion order", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "nitro-alias-"));
    const entries: [string, string][] = [
      ["#api", "./api"],
      ["#api-admin", "./admin"],
    ];

    try {
      for (const reverse of [false, true]) {
        const options = await loadOptions(
          {
            rootDir,
            preset: "node",
            builder: false,
            serverEntry: false,
            renderer: false,
            alias: Object.fromEntries(reverse ? [...entries].reverse() : entries),
            routes: { "/test": "#api-admin/handler.ts" },
          },
          {
            dotenv: false,
            c12: {
              configFile: "__empty__",
              rcFile: false,
              globalRc: false,
              packageJson: false,
            },
          }
        );

        const route = options.routes["/test"];
        if (typeof route === "string") {
          throw new TypeError("Expected route to be an object");
        }
        expect(relative(rootDir, route.handler)).toBe("admin/handler.ts");
      }
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
