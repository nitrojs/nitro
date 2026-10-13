import { describe, expect, it } from "vitest";
import { parseSync } from "rolldown/utils";
import type { NormalizedOutputOptions, Plugin, PluginContext, RenderedChunk } from "rollup";
import { cloudflareOutputRewrites } from "../../src/presets/cloudflare/output-plugins.ts";

async function renderChunk(code: string, plugin: Plugin = cloudflareOutputRewrites()) {
  const warnings: string[] = [];
  const hook = plugin.renderChunk;
  const handler = typeof hook === "function" ? hook : hook?.handler;
  // Throws rather than returning `code` unchanged, so that the negative tests
  // below cannot pass by the hook having been dropped or renamed.
  if (!handler) {
    throw new Error("plugin does not implement the `renderChunk` hook");
  }
  const result = await handler.call(
    { warn: (warning: unknown) => warnings.push(String(warning)) } as unknown as PluginContext,
    code,
    { fileName: "index.mjs" } as RenderedChunk,
    { sourcemap: false } as NormalizedOutputOptions,
    { chunks: {} }
  );
  const output = typeof result === "string" ? result : (result?.code ?? code);
  return { output, warnings };
}

// A regex literal holding a quote, a `//` byte pair and braces. Text scanners
// desync on these and then rewrite (or skip) the rest of the chunk wrongly.
const REGEX_LITERALS = String.raw`const enc = /[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]]/i;
const esc = (s) => s.replace(/<\//g, "<\\/");
const has = (x) => /{/.test(x) && x / 2 > 1;
`;

describe("cloudflareOutputRewrites", () => {
  describe("createRequire", () => {
    it("rewrites real call sites", async () => {
      const input = `import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
export { _require };
`;
      const { output } = await renderChunk(input);
      expect(output).toContain('const _require = createRequire(import.meta.url || "file:///");');
    });

    it("rewrites minified call sites through the renamed import binding", async () => {
      const input = `import{createRequire as e}from"node:module";const r=e(import.meta.url);export{r};`;
      const { output } = await renderChunk(input);
      expect(output).toBe(
        `import{createRequire as e}from"node:module";const r=e(import.meta.url || "file:///");export{r};`
      );
    });

    it("does not rewrite string data, even after a regex literal", async () => {
      const input = `${REGEX_LITERALS}const kit = { "h3.mjs": "const _require = createRequire(import.meta.url);\\nexport default _require;" };
export { kit, enc, esc, has };
`;
      const { output } = await renderChunk(input);
      expect(output).toBe(input);
    });

    it("does not rewrite template text or comments", async () => {
      const input = `const source = \`const _require = createRequire(import.meta.url);\`;
// createRequire(import.meta.url)
/* createRequire(import.meta.url) */
export { source };
`;
      const { output } = await renderChunk(input);
      expect(output).toBe(input);
    });

    it("still rewrites call sites inside template expressions", async () => {
      const input = "const source = `url=${createRequire(import.meta.url)}`;\n";
      const { output } = await renderChunk(input);
      expect(output).toBe(
        'const source = `url=${createRequire(import.meta.url || "file:///")}`;\n'
      );
    });

    it("rewrites real call sites without touching string data in the same chunk", async () => {
      const input = `${REGEX_LITERALS}const _require = createRequire(import.meta.url);
const kit = { "h3.mjs": "const _require = createRequire(import.meta.url);" };
export { _require, kit, enc, esc, has };
`;
      const { output } = await renderChunk(input);
      expect(output).toContain('const _require = createRequire(import.meta.url || "file:///");');
      expect(output).toContain('"const _require = createRequire(import.meta.url);"');
      expect(parseSync("index.mjs", output).errors).toEqual([]);
    });

    it("is idempotent", async () => {
      const input = `const _require = createRequire(import.meta.url || "file:///");\n`;
      const { output } = await renderChunk(input);
      expect(output).toBe(input);
    });
  });

  describe("bare node: imports", () => {
    it("strips real bare node: side-effect imports", async () => {
      const input = `import "node:fs";
export const marker = 1;
`;
      const { output } = await renderChunk(input);
      expect(output).toBe(`
export const marker = 1;
`);
    });

    it("strips minified bare node: side-effect imports", async () => {
      const input = `import"node:buffer";import{Buffer as e}from"node:buffer";export{e};`;
      const { output } = await renderChunk(input);
      expect(output).toBe(`import{Buffer as e}from"node:buffer";export{e};`);
    });

    it("keeps node: imports that have specifiers", async () => {
      const input = `import { readFile } from "node:fs";
export { readFile };
`;
      const { output } = await renderChunk(input);
      expect(output).toBe(input);
    });

    it("does not strip a matching line inside a template literal", async () => {
      // `import "node:fs";` on its own line inside template text is data, not an
      // import declaration (the issue #4526 case).
      const input = 'const source = `foo\nimport "node:fs";\nexport const nitro4526marker = 1;`;\n';
      const { output } = await renderChunk(input);
      expect(output).toBe(input);
      expect(output).toContain('import "node:fs";');
      expect(output).toContain("nitro4526marker");
    });
  });

  it("leaves the chunk untouched and warns when it cannot be parsed", async () => {
    const input = `import "node:fs"; const _require = createRequire(import.meta.url); const broken = (;\n`;
    const { output, warnings } = await renderChunk(input);
    expect(output).toBe(input);
    expect(warnings[0]).toContain("Could not parse");
  });
});
