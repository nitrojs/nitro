import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { dirname, join } from "pathe";
import { pkgDir } from "#nitro/meta";
import { afterAll, describe, expect, it } from "vitest";
import { build, createDevServer, createNitro, prepare } from "../../src/builder.ts";
import { externals } from "../../src/build/plugins/externals.ts";

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createTmpProject(files: Record<string, string>) {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-dev-externals-"));
  tmpDirs.push(rootDir);
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(rootDir, path)), { recursive: true });
    writeFileSync(join(rootDir, path), contents);
  }
  symlinkSync(pkgDir, join(rootDir, "node_modules/nitro"), "junction");
  return rootDir;
}

describe("externals in dev (non-Node-compatible ESM dependencies, #5191)", () => {
  it("resolves plugin behavior for CJS, valid ESM, untyped ESM, and extensionless ESM", async () => {
    const dir = createTmpProject({
      "node_modules/cjs-with-comment/package.json": JSON.stringify({ name: "cjs-with-comment" }),
      "node_modules/cjs-with-comment/index.js": [
        "// import x from './missing'",
        `module.exports = "export default not-esm";`,
      ].join("\n"),
      "node_modules/valid-esm/package.json": JSON.stringify({
        name: "valid-esm",
        type: "module",
      }),
      "node_modules/valid-esm/index.js": `import { val } from "./sub.js"; export default val;`,
      "node_modules/valid-esm/sub.js": `export const val = "ok";`,
      "node_modules/dayjs/package.json": JSON.stringify({
        name: "dayjs",
        main: "dayjs.min.js",
      }),
      "node_modules/dayjs/esm/index.js": `import * as C from "./constant"; export default C.FORMAT;`,
      "node_modules/dayjs/esm/constant.js": `export const FORMAT = "YYYY-MM-DD";`,
      "node_modules/extensionless-esm/package.json": JSON.stringify({
        name: "extensionless-esm",
        type: "module",
      }),
      "node_modules/extensionless-esm/index.js": `export { x } from "./helper";`,
      "node_modules/extensionless-esm/helper.js": `export const x = 42;`,
    });

    const plugin = externals({
      rootDir: dir,
      conditions: ["node", "import", "default"],
      exclude: [],
      include: [],
      trace: false,
    });
    const handler = (plugin.resolveId as { handler: Function }).handler;

    const resolveTo = (target: string) => ({
      resolve: async () => ({ id: join(dir, target) }),
    });

    // Valid CJS (even with comments/strings mentioning import/export) stays external
    const cjsPath = join(dir, "node_modules/cjs-with-comment/index.js");
    expect(
      await handler.call(
        resolveTo("node_modules/cjs-with-comment/index.js"),
        "cjs-with-comment",
        undefined,
        {}
      )
    ).toMatchObject({
      external: true,
      id: pathToFileURL(cjsPath).href,
    });

    // Valid Node ESM ("type": "module" + explicit extensions) stays external
    const validEsmPath = join(dir, "node_modules/valid-esm/index.js");
    expect(
      await handler.call(resolveTo("node_modules/valid-esm/index.js"), "valid-esm", undefined, {})
    ).toMatchObject({
      external: true,
      id: pathToFileURL(validEsmPath).href,
    });

    // Untyped .js ESM (dayjs/esm) must NOT be externalized
    const dayjsPath = join(dir, "node_modules/dayjs/esm/index.js");
    const dayjsRes = await handler.call(
      resolveTo("node_modules/dayjs/esm/index.js"),
      "dayjs/esm",
      undefined,
      {}
    );
    expect(dayjsRes.external).not.toBe(true);
    expect(dayjsRes.id).toBe(dayjsPath);

    // Typed ESM with extensionless relative imports must NOT be externalized
    const extlessPath = join(dir, "node_modules/extensionless-esm/index.js");
    const extlessRes = await handler.call(
      resolveTo("node_modules/extensionless-esm/index.js"),
      "extensionless-esm",
      undefined,
      {}
    );
    expect(extlessRes.external).not.toBe(true);
    expect(extlessRes.id).toBe(extlessPath);

    // CommonJS plugin proxy (`meta.commonjs.resolved`) preserves rawResolved when inlined
    const cjsProxy = {
      id: `${dayjsPath}?commonjs-proxy`,
      meta: { commonjs: { resolved: { id: dayjsPath } } },
    };
    expect(await handler.call({ resolve: async () => cjsProxy }, "dayjs/esm", undefined, {})).toBe(
      cjsProxy
    );
  });

  it.each(["rolldown", "rollup"] as const)(
    "inlines dayjs/esm-style packages while keeping valid externals in nitro-dev (%s)",
    async (builder) => {
      const rootDir = createTmpProject({
        "package.json": JSON.stringify({ type: "module" }),
        "nitro.config.ts": `export default {};`,
        "routes/index.ts": [
          `import { defineHandler } from "nitro/h3";`,
          `import dayjs from "dayjs/esm";`,
          `import utc from "dayjs/esm/plugin/utc";`,
          `import validCjs from "valid-cjs";`,
          `import validEsm from "valid-esm";`,
          `export default defineHandler(async () => {`,
          `  const dyn = (await import("dayjs/esm")).default;`,
          `  return { dayjs: dayjs("2025-01-01"), dyn: dyn("2025-01-02"), utc: utc(), validCjs, validEsm };`,
          `});`,
        ].join("\n"),
        "node_modules/dayjs/package.json": JSON.stringify({
          name: "dayjs",
          version: "1.11.23",
          main: "dayjs.min.js",
        }),
        "node_modules/dayjs/dayjs.min.js": `module.exports = (v) => v;`,
        "node_modules/dayjs/esm/index.js": [
          `import * as C from "./constant";`,
          `import U from "./utils";`,
          `export default function dayjs(d) { return U(d, C.FORMAT); }`,
        ].join("\n"),
        "node_modules/dayjs/esm/constant.js": `export const FORMAT = "YYYY-MM-DD";`,
        "node_modules/dayjs/esm/utils/index.js": `export default (d, f) => d + ":" + f;`,
        "node_modules/dayjs/esm/plugin/utc/index.js": [
          `import * as C from "../../constant";`,
          `export default () => "utc:" + C.FORMAT;`,
        ].join("\n"),
        "node_modules/valid-cjs/package.json": JSON.stringify({
          name: "valid-cjs",
          version: "1.0.0",
        }),
        "node_modules/valid-cjs/index.js": `module.exports = "cjs-ok";`,
        "node_modules/valid-esm/package.json": JSON.stringify({
          name: "valid-esm",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/valid-esm/index.js": `import { tag } from "./tag.js"; export default tag;`,
        "node_modules/valid-esm/tag.js": `export const tag = "esm-ok";`,
      });

      const nitro = await createNitro({
        rootDir,
        serverDir: ".",
        dev: true,
        preset: "nitro-dev",
        compatibilityDate: "latest",
        builder,
        logLevel: 0,
      });
      const server = await createDevServer(nitro).listen({ port: 0 });
      try {
        await prepare(nitro);
        const ready = new Promise<void>((resolve) => {
          nitro.hooks.hook("dev:reload", () => resolve());
        });
        await build(nitro);
        await ready;

        const res = await fetch(new URL("/", server.url));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          dayjs: "2025-01-01:YYYY-MM-DD",
          dyn: "2025-01-02:YYYY-MM-DD",
          utc: "utc:YYYY-MM-DD",
          validCjs: "cjs-ok",
          validEsm: "esm-ok",
        });

        const built = readFileSync(join(nitro.options.output.serverDir, "index.mjs"), "utf8");
        expect(built).toMatch(/from\s+["']file:\/\/[^"']*valid-cjs\/index\.js["']/);
        expect(built).toMatch(/from\s+["']file:\/\/[^"']*valid-esm\/index\.js["']/);
        expect(built).not.toMatch(/from\s+["']file:\/\/[^"']*dayjs\/esm\//);
      } finally {
        await server.close();
        await nitro.close();
      }
    }
  );
});
