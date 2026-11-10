import { readFile } from "node:fs/promises";
import { parseSync } from "rolldown/utils";
import { glob } from "tinyglobby";
import { describe, expect, it } from "vitest";
import { rewriteSelfImports } from "../../scripts/_dts-self-imports.ts";

// The package can be installed under another name (e.g. `nitro-nightly` as `nitro`), where bare
// `nitro/*` imports of its own build-time code would resolve to another installed Nitro version.
// Runtime files keep them: they are bundled with (and share module instances with) the app.
// `src/types` only has declarations (its side-effect imports are dropped from the output).
describe("self imports", () => {
  it("build-time code does not import `nitro` by its package name", async () => {
    const files = await glob([
      "src/**/*.ts",
      "!src/{runtime,types}/**",
      "!src/presets/*/runtime/**",
    ]);
    const selfImports: string[] = [];
    for (const file of files) {
      const code = await readFile(file, "utf8");
      const { module } = parseSync(file, code);
      const requests = [
        ...module.staticImports
          .filter((i) => i.entries.length === 0 || i.entries.some((e) => !e.isType))
          .map((i) => i.moduleRequest.value),
        ...module.staticExports.flatMap((e) =>
          e.entries.filter((entry) => !entry.isType).map((entry) => entry.moduleRequest?.value)
        ),
        ...module.dynamicImports.map((i) =>
          code.slice(i.moduleRequest.start, i.moduleRequest.end).replace(/^["'`]|["'`]$/g, "")
        ),
      ];
      for (const id of requests) {
        if (id && /^nitro(?:\/|$)/.test(id)) {
          selfImports.push(`${file}: ${id}`);
        }
      }
    }
    expect(selfImports).toEqual([]);
  });

  it("declaration files reference `nitro` relatively", () => {
    const exports = { ".": "./dist/runtime/nitro.mjs", "./types": "./dist/types/index.mjs" };
    const code = [
      `import {\n  Nitro,\n  NitroConfig\n} from "nitro/types";`,
      `export * from "nitro";`,
      `type Hooks = import("nitro/types").NitroRuntimeHooks;`,
      `declare module 'nitro/types' {}`,
      `declare module "h3/rules" {}`,
      `type Name = "nitro";`,
    ].join("\n");
    expect(rewriteSelfImports(code, { file: "dist/types/index.d.mts", exports }))
      .toMatchInlineSnapshot(`
        "import {
          Nitro,
          NitroConfig
        } from "./index.mjs";
        export * from "../runtime/nitro.mjs";
        type Hooks = import("./index.mjs").NitroRuntimeHooks;
        declare module "./index.mjs" {}
        declare module "h3/rules" {}
        type Name = "nitro";"
      `);
    expect(() =>
      rewriteSelfImports(`type T = import("nitro/nope").T;`, { file: "dist/vite.d.mts", exports })
    ).toThrow("Unexpected `nitro/nope` specifier in `dist/vite.d.mts`");
  });
});
