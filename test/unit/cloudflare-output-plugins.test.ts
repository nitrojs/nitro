import { describe, expect, it } from "vitest";
import type { NormalizedOutputOptions, Plugin } from "rollup";
import {
  guardCreateRequire,
  stripBareNodeImports,
} from "../../src/presets/cloudflare/output-plugins.ts";

type Chunk = { type: "chunk"; code: string };

function applyPlugin(plugin: Plugin, code: string): string {
  const bundle = { "index.mjs": { type: "chunk", code } satisfies Chunk };
  const hook = plugin.generateBundle;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  fn?.call({} as any, {} as NormalizedOutputOptions, bundle, false);
  return bundle["index.mjs"].code;
}

describe("guardCreateRequire", () => {
  it("rewrites real createRequire(import.meta.url) call sites", () => {
    const input = `import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
export { _require };
`;
    const output = applyPlugin(guardCreateRequire(), input);
    expect(output).toContain('createRequire(import.meta.url || "file:///")');
    expect(output).not.toMatch(/const _require = createRequire\(import\.meta\.url\);/);
  });

  it("does not rewrite createRequire inside double-quoted string data", () => {
    const input = `const kit = { "h3.mjs": "const _require = createRequire(import.meta.url);\\nexport default _require;" };`;
    const output = applyPlugin(guardCreateRequire(), input);
    expect(output).toBe(input);
    expect(() => new Function(output)).not.toThrow();
  });

  it("does not rewrite createRequire inside template text or comments", () => {
    const input = `const source = \`const _require = createRequire(import.meta.url);\`;
// createRequire(import.meta.url)
/* createRequire(import.meta.url) */
export { source };
`;
    const output = applyPlugin(guardCreateRequire(), input);
    expect(output).toBe(input);
  });

  it("still rewrites call sites inside template expressions", () => {
    const input = "const source = `url=${createRequire(import.meta.url)}`;\n";
    const output = applyPlugin(guardCreateRequire(), input);
    expect(output).toBe('const source = `url=${createRequire(import.meta.url || "file:///")}`;\n');
  });

  it("rewrites real call sites without touching string data in the same chunk", () => {
    const input = `const _require = createRequire(import.meta.url);
const kit = { "h3.mjs": "const _require = createRequire(import.meta.url);" };
`;
    const output = applyPlugin(guardCreateRequire(), input);
    expect(output).toContain('const _require = createRequire(import.meta.url || "file:///");');
    expect(output).toContain('"const _require = createRequire(import.meta.url);"');
  });
});

describe("stripBareNodeImports", () => {
  it("strips real bare node: side-effect imports", () => {
    const input = `import "node:fs";
export const marker = 1;
`;
    const output = applyPlugin(stripBareNodeImports(), input);
    expect(output).toBe(`
export const marker = 1;
`);
  });

  it("does not strip a matching line inside a template literal", () => {
    // `^...$` with the `m` flag matches a full line after a newline, including
    // lines that live inside template text (the issue #4526 case). A match on
    // the same line as the opening backtick is not this bug.
    const input = 'const source = `foo\nimport "node:fs";\nexport const nitro4526marker = 1;`;\n';
    const output = applyPlugin(stripBareNodeImports(), input);
    expect(output).toBe(input);
    expect(output).toContain('import "node:fs";');
    expect(output).toContain("nitro4526marker");
  });
});
