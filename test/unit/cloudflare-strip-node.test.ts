import { describe, expect, it } from "vitest";
import { stripBareNodeImports } from "../../src/presets/cloudflare/preset";
import type { OutputBundle, OutputChunk } from "rollup";

describe("stripBareNodeImports", () => {
  const plugin = stripBareNodeImports();

  function runPlugin(code: string): string {
    const bundle: OutputBundle = {
      "index.mjs": {
        type: "chunk",
        code,
      } as OutputChunk,
    };
    // @ts-ignore
    plugin.generateBundle({}, bundle);
    return (bundle["index.mjs"] as OutputChunk).code;
  }

  it("strips bare node:* side-effect imports in multiline code", () => {
    const input = `import "./chunk1.mjs";\nimport "node:process";\nimport "node:buffer";\nexport default {};`;
    const output = runPlugin(input);
    expect(output).not.toContain("node:process");
    expect(output).not.toContain("node:buffer");
    expect(output).toContain('import "./chunk1.mjs";');
    expect(output).toContain("export default {};");
  });

  it("strips bare node:* imports in single-line minified code", () => {
    const input = `import "./chunk1.mjs";import"node:process";import"cloudflare:workers";`;
    const output = runPlugin(input);
    expect(output).not.toContain("node:process");
    expect(output).toBe('import "./chunk1.mjs";import"cloudflare:workers";');
  });

  it("preserves named and default imports from node:* modules", () => {
    const input = `import { env } from "node:process";\nimport process from "node:process";\nconsole.log(env);`;
    const output = runPlugin(input);
    expect(output).toBe(input);
  });

  it("preserves dynamic imports of node:* modules", () => {
    const input = `const p = import("node:process");`;
    const output = runPlugin(input);
    expect(output).toBe(input);
  });

  it("preserves non-node bare side-effect imports", () => {
    const input = `import "some-polyfill";\nimport "./local-side-effect.mjs";\nexport default {};`;
    const output = runPlugin(input);
    expect(output).toBe(input);
  });

  it("registers stripBareNodeImports plugin on cloudflare presets", async () => {
    const { createNitro } = await import("nitropack/core");
    for (const preset of ["cloudflare-module", "cloudflare-pages"]) {
      const nitro = await createNitro({
        preset,
        compatibilityDate: "2025-07-15",
      });
      const plugins = (nitro.options.rollupConfig?.plugins as any[]) || [];
      const stripPlugin = plugins.find(
        (p) => p && p.name === "nitro:cloudflare-strip-bare-node-imports"
      );
      expect(stripPlugin).toBeDefined();
    }
  });
});
