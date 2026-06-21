import { describe, expect, it, vi } from "vitest";
import { cjsRequire, type CjsRequireMode } from "../../src/build/plugins/cjs-require.ts";

type Chunk = {
  type: "chunk";
  fileName: string;
  code: string;
  modules: Record<string, unknown>;
};

function chunk(fileName: string, code: string, moduleIds: string[] = []): Chunk {
  return {
    type: "chunk",
    fileName,
    code,
    modules: Object.fromEntries(moduleIds.map((id) => [id, {}])),
  };
}

function run(bundle: Record<string, Chunk>, mode: CjsRequireMode = "react") {
  const warn = vi.fn();
  const plugin = cjsRequire({ logger: { warn } } as any, mode);
  (plugin.generateBundle as Function).call(null, {}, bundle);
  return { warn };
}

describe("cjsRequire (nitrojs/nitro#4171)", () => {
  it("rewrites a leaked __require() to the bundled initializer", () => {
    const bundle = {
      "_libs/react.mjs": chunk(
        "_libs/react.mjs",
        `var require_react = /* @__PURE__ */ __commonJSMin(() => {});\nexport { require_react as n };`,
        ["/app/node_modules/react/index.js"]
      ),
      "_ssr/ssr.mjs": chunk("_ssr/ssr.mjs", `var React = __require("react");`, [
        "/app/node_modules/use-sync-external-store/shim.js",
      ]),
    };
    const { warn } = run(bundle);

    const consumer = bundle["_ssr/ssr.mjs"].code;
    expect(consumer).not.toContain(`__require("react")`);
    expect(consumer).toContain(`import { n as __nitroCjs_react } from "../_libs/react.mjs";`);
    expect(consumer).toContain(`var React = __nitroCjs_react();`);
    expect(warn).not.toHaveBeenCalled();
  });

  it("adds an export when the bundled initializer is defined but not exported", () => {
    const bundle = {
      "_libs/react-dom.mjs": chunk(
        "_libs/react-dom.mjs",
        `var require_react_dom = /* @__PURE__ */ __commonJSMin(() => {});\nvar require_server_edge = /* @__PURE__ */ __commonJSMin(() => {});\nexport { require_server_edge as t };`,
        ["/app/node_modules/react-dom/index.js"]
      ),
      "_ssr/ssr.mjs": chunk("_ssr/ssr.mjs", `var ReactDOM = __require("react-dom");`, [
        "/app/node_modules/some-ui-lib/dist/index.js",
      ]),
    };
    run(bundle);

    expect(bundle["_libs/react-dom.mjs"].code).toContain(
      `export { require_react_dom as __nitro_require_react_dom };`
    );
    expect(bundle["_ssr/ssr.mjs"].code).toContain(
      `import { __nitro_require_react_dom as __nitroCjs_react_dom } from "../_libs/react-dom.mjs";`
    );
    expect(bundle["_ssr/ssr.mjs"].code).toContain(`var ReactDOM = __nitroCjs_react_dom();`);
  });

  it("leaves genuinely external requires untouched and does not warn", () => {
    const code = `var db = __require("better-sqlite3");`;
    const bundle = {
      "index.mjs": chunk("index.mjs", code, ["/app/src/index.ts"]),
    };
    const { warn } = run(bundle);

    expect(bundle["index.mjs"].code).toBe(code);
    expect(warn).not.toHaveBeenCalled();
  });

  it(`"react" mode leaves a non-React bundled dependency alone and warns`, () => {
    const bundle = {
      "_libs/some-lib.mjs": chunk(
        "_libs/some-lib.mjs",
        `var require_some_lib = /* @__PURE__ */ __commonJSMin(() => {});\nexport { require_some_lib as q };`,
        ["/app/node_modules/some-lib/index.js"]
      ),
      "_ssr/ssr.mjs": chunk("_ssr/ssr.mjs", `var x = __require("some-lib");`, [
        "/app/node_modules/consumer/index.js",
      ]),
    };
    const { warn } = run(bundle, "react");

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("some-lib");
    expect(bundle["_ssr/ssr.mjs"].code).toContain(`__require("some-lib")`);
  });

  it(`"all" mode rewrites any bundled dependency via its derived initializer`, () => {
    const bundle = {
      "_libs/some-lib.mjs": chunk(
        "_libs/some-lib.mjs",
        `var require_some_lib = /* @__PURE__ */ __commonJSMin(() => {});\nexport { require_some_lib as q };`,
        ["/app/node_modules/some-lib/index.js"]
      ),
      "_ssr/ssr.mjs": chunk("_ssr/ssr.mjs", `var x = __require("some-lib");`, [
        "/app/node_modules/consumer/index.js",
      ]),
    };
    const { warn } = run(bundle, "all");

    expect(bundle["_ssr/ssr.mjs"].code).not.toContain(`__require("some-lib")`);
    expect(bundle["_ssr/ssr.mjs"].code).toContain(
      `import { q as __nitroCjs_some_lib } from "../_libs/some-lib.mjs";`
    );
    expect(bundle["_ssr/ssr.mjs"].code).toContain(`var x = __nitroCjs_some_lib();`);
    expect(warn).not.toHaveBeenCalled();
  });

  it(`"all" mode still warns when no bundled initializer can be found`, () => {
    const bundle = {
      // package is bundled (module present) but has no CJS initializer to reuse
      "_libs/some-lib.mjs": chunk("_libs/some-lib.mjs", `export const x = 1;`, [
        "/app/node_modules/some-lib/index.js",
      ]),
      "_ssr/ssr.mjs": chunk("_ssr/ssr.mjs", `var x = __require("some-lib");`, [
        "/app/node_modules/consumer/index.js",
      ]),
    };
    const { warn } = run(bundle, "all");

    expect(warn).toHaveBeenCalledOnce();
    expect(bundle["_ssr/ssr.mjs"].code).toContain(`__require("some-lib")`);
  });

  it("is a no-op when there are no leaked requires", () => {
    const original = `import { createElement } from "../_libs/react.mjs";`;
    const bundle = { "_ssr/ssr.mjs": chunk("_ssr/ssr.mjs", original) };
    const { warn } = run(bundle);

    expect(bundle["_ssr/ssr.mjs"].code).toBe(original);
    expect(warn).not.toHaveBeenCalled();
  });
});
