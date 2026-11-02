import { parseAst } from "rollup/parseAst";
import type {
  NormalizedOutputOptions,
  PluginContext,
  RenderedChunk,
  RenderChunkHook,
} from "rollup";
import { describe, expect, it, vi } from "vitest";

import legacyPresets from "../../src/presets/cloudflare/preset-legacy";
import presets from "../../src/presets/cloudflare/preset";
import { cloudflareOutputRewrites } from "../../src/presets/cloudflare/output-plugins";

type Parse = (code: string) => unknown;

type RenderOptions = {
  parse?: Parse;
  sourcemap?: boolean;
};

async function renderChunk(code: string, options: RenderOptions = {}) {
  const warnings: string[] = [];
  const parse = vi.fn(options.parse ?? ((source: string) => parseAst(source)));
  const plugin = cloudflareOutputRewrites();
  const hook = plugin.renderChunk;
  const handler = typeof hook === "function" ? hook : hook?.handler;
  // Throws rather than returning `code` unchanged, so that the negative tests
  // below cannot pass by the hook having been dropped or renamed.
  if (!handler) {
    throw new Error("plugin does not implement the `renderChunk` hook");
  }
  const result = await (handler as RenderChunkHook).call(
    {
      parse,
      warn: (warning: unknown) => warnings.push(String(warning)),
    } as unknown as PluginContext,
    code,
    { fileName: "index.mjs" } as RenderedChunk,
    { sourcemap: options.sourcemap ?? false } as NormalizedOutputOptions,
    { chunks: {} }
  );
  const resultCode = typeof result === "string" ? result : result?.code;
  return {
    result: resultCode,
    code: resultCode ?? code,
    map:
      typeof result === "string"
        ? undefined
        : (result?.map as { sources?: string[] } | string | undefined),
    warnings,
    parse,
  };
}

// A regex literal holding a quote, a `//` byte pair and braces. Text scanners
// desync on these and then rewrite (or skip) the rest of the chunk wrongly.
const REGEX_LITERALS = String.raw`const enc = /[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]]/i;
const esc = (s) => s.replace(/<\//g, "<\\/");
const has = (x) => /{/.test(x) && x / 2 > 1;
`;

describe("cloudflareOutputRewrites", () => {
  describe("bare node: imports", () => {
    it("strips bare node: side-effect imports and keeps named imports", async () => {
      const input = `import "node:fs";
import { readFile } from "node:fs";
export { readFile };
`;
      const { code } = await renderChunk(input);
      expect(code).toBe(`
import { readFile } from "node:fs";
export { readFile };
`);
    });

    it("strips minified bare node: imports", async () => {
      const input = `import"node:buffer";import{Buffer as e}from"node:buffer";export{e};`;
      const { code } = await renderChunk(input);
      expect(code).toBe(`import{Buffer as e}from"node:buffer";export{e};`);
    });

    it("preserves bare imports that are not node: built-ins", async () => {
      const input = `import "side-effect";
import "node:fs";
export const marker = 1;
`;
      const { code } = await renderChunk(input);
      expect(code).toBe(`import "side-effect";

export const marker = 1;
`);
    });

    it("does not strip a matching line inside template text", async () => {
      // `import "node:fs";` on its own line inside template text is data, not an
      // import declaration (the issue #4526 case).
      const input =
        'const source = `foo\nimport "node:fs";\nexport const nitro4526marker = 1;`;\n';
      const { code } = await renderChunk(input);
      expect(code).toBe(input);
      expect(code).toContain('import "node:fs";');
      expect(code).toContain("nitro4526marker");
    });

    it("does not strip node: imports inside strings, comments, or regex literals", async () => {
      const input = `${REGEX_LITERALS}const source = 'import "node:fs";';
// import "node:fs";
/* import "node:fs"; */
export { source, enc, esc, has };
`;
      const { code } = await renderChunk(input);
      expect(code).toBe(input);
    });
  });

  describe("createRequire", () => {
    it("rewrites real and renamed call sites", async () => {
      const input = `import { createRequire } from "node:module";
import { createRequire as cr } from "node:module";
const a = createRequire(import.meta.url);
const b = cr(import.meta.url);
export { a, b };
`;
      const { code } = await renderChunk(input);
      expect(code).toContain(
        'const a = createRequire(import.meta.url || "file:///");'
      );
      expect(code).toContain('const b = cr(import.meta.url || "file:///");');
    });

    it("rewrites minified call sites through the renamed import binding", async () => {
      const input = `import{createRequire as e}from"node:module";const r=e(import.meta.url);export{r};`;
      const { code } = await renderChunk(input);
      expect(code).toBe(
        `import{createRequire as e}from"node:module";const r=e(import.meta.url || "file:///");export{r};`
      );
    });

    it("rewrites call sites bound through a string-literal imported name", async () => {
      const input = `import { "createRequire" as cr } from "node:module";
const r = cr(import.meta.url);
export { r };
`;
      const { code } = await renderChunk(input);
      expect(code).toContain('const r = cr(import.meta.url || "file:///");');
    });

    it("does not rewrite string data, even after a regex literal", async () => {
      const input = `${REGEX_LITERALS}const kit = { "h3.mjs": "const _require = createRequire(import.meta.url);\\nexport default _require;" };
export { kit, enc, esc, has };
`;
      const { code } = await renderChunk(input);
      expect(code).toBe(input);
    });

    it("does not rewrite template text or comments", async () => {
      const input = `const source = \`const _require = createRequire(import.meta.url);\`;
// createRequire(import.meta.url)
/* createRequire(import.meta.url) */
export { source };
`;
      const { code } = await renderChunk(input);
      expect(code).toBe(input);
    });

    it("still rewrites call sites inside template expressions", async () => {
      const input = "const source = `url=${createRequire(import.meta.url)}`;\n";
      const { code } = await renderChunk(input);
      expect(code).toBe(
        'const source = `url=${createRequire(import.meta.url || "file:///")}`;\n'
      );
    });

    it("leaves negative call shapes unchanged", async () => {
      const input = `import { createRequire } from "node:module";
const a = createRequire();
const b = createRequire(import.meta.url, {});
const c = require.createRequire(import.meta.url);
const d = createRequire(import.meta);
const e = createRequire(import.meta["url"]);
const f = createRequire(import.meta.dirname);
const g = createRequire(foo.url);
export { a, b, c, d, e, f, g };
`;
      const { code } = await renderChunk(input);
      expect(code).toBe(input);
    });

    it("is idempotent", async () => {
      const input = `const _require = createRequire(import.meta.url || "file:///");\n`;
      const { result } = await renderChunk(input);
      expect(result).toBeUndefined();
    });
  });

  describe("rendering", () => {
    it("warns and leaves the chunk unchanged when parsing fails", async () => {
      const input = `import "node:fs";\nconst broken = (;\n`;
      const { result, code, warnings, parse } = await renderChunk(input, {
        parse: () => {
          throw new Error("Unexpected token");
        },
      });
      expect(parse).toHaveBeenCalledOnce();
      expect(result).toBeUndefined();
      expect(code).toBe(input);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("Could not parse `index.mjs`");
      expect(warnings[0]).toContain("Unexpected token");
    });

    it("warns and leaves the chunk unchanged for non-Error parse failures", async () => {
      const input = `import "node:fs";\n`;
      const { result, code, warnings } = await renderChunk(input, {
        parse: () => {
          throw "not an error";
        },
      });
      expect(result).toBeUndefined();
      expect(code).toBe(input);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("Could not parse `index.mjs`");
      expect(warnings[0]).toContain("not an error");
    });

    it("returns a source map for rewritten chunks when sourcemaps are enabled", async () => {
      const input = `import "node:fs";\nexport const marker = 1;\n`;
      const { map } = await renderChunk(input, { sourcemap: true });
      expect(map).toBeDefined();
      expect((map as { sources: string[] }).sources).toContain("index.mjs");
    });

    it("does not return a source map when sourcemaps are disabled", async () => {
      const input = `import "node:fs";\nexport const marker = 1;\n`;
      const { map } = await renderChunk(input, { sourcemap: false });
      expect(map).toBeUndefined();
    });

    it("does not parse chunks that cannot contain a match", async () => {
      const input = `export const marker = 1;\n`;
      const { result, code, parse } = await renderChunk(input);
      expect(parse).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
      expect(code).toBe(input);
    });
  });
});

type PresetWithMeta = {
  _meta?: { name?: string };
  rollupConfig?: { plugins?: unknown };
};

function findPreset(list: PresetWithMeta[], name: string): PresetWithMeta {
  const preset = list.find((entry) => entry._meta?.name === name);
  if (!preset) {
    throw new Error(`missing preset: ${name}`);
  }
  return preset;
}

function pluginNames(preset: PresetWithMeta): string[] {
  const plugins = preset.rollupConfig?.plugins;
  const list = Array.isArray(plugins) ? plugins : [plugins];
  return list.flatMap((plugin) => {
    if (!plugin) {
      return [];
    }
    if (typeof plugin === "function") {
      const result = plugin();
      return result && typeof result === "object" && "name" in result
        ? [String(result.name)]
        : [];
    }
    return typeof plugin === "object" && "name" in plugin
      ? [String(plugin.name)]
      : [];
  });
}

describe("cloudflare preset registration", () => {
  it.each([
    ["cloudflare-pages", presets as PresetWithMeta[]],
    ["cloudflare-module", presets as PresetWithMeta[]],
    ["cloudflare-module-legacy", legacyPresets as PresetWithMeta[]],
  ])("registers the output rewrite plugin for %s", (name, list) => {
    const preset = findPreset(list, name);
    expect(pluginNames(preset)).toContain("nitro:cloudflare-output-rewrites");
  });
});
