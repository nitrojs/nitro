import { afterEach, describe, expect, it, vi } from "vitest";
import type { Nitro } from "nitro/types";
import type { NormalizedOutputOptions, Plugin, PluginContext, RenderedChunk } from "rollup";

const rootDir = process.cwd();

const loadOXC = async () => {
  vi.resetModules();
  return import("../../src/utils/oxc.ts");
};

const withoutRolldown = () => {
  vi.doMock("exsolve", async (importOriginal) => {
    const exsolve = await importOriginal<typeof import("exsolve")>();
    return {
      ...exsolve,
      resolveModulePath: ((id, opts) =>
        id === "rolldown/utils"
          ? undefined
          : exsolve.resolveModulePath(id, opts)) as typeof exsolve.resolveModulePath,
    };
  });
};

describe("importOXC", () => {
  afterEach(() => {
    vi.doUnmock("exsolve");
  });

  it("uses rolldown when it is resolvable from the project", async () => {
    const { importOXC } = await loadOXC();
    const rolldownUtils = await import("rolldown/utils");
    const oxc = await importOXC({ dir: rootDir });
    expect(oxc.parseSync).toBe(rolldownUtils.parseSync);
    expect(oxc.minifySync).toBe(rolldownUtils.minifySync);
  });

  it("resolves rolldown through vite when it is not a direct dependency", async () => {
    // Strict layout (pnpm): `rolldown/utils` is only resolvable from inside the `vite` package
    vi.doMock("exsolve", async (importOriginal) => {
      const exsolve = await importOriginal<typeof import("exsolve")>();
      const isVite = (from: unknown): from is string => /[/\\]vite[/\\]/.test(String(from));
      return {
        ...exsolve,
        resolveModulePath: ((id, opts) => {
          if (id !== "rolldown/utils") {
            return exsolve.resolveModulePath(id, opts);
          }
          const from = [opts?.from].flat().filter(isVite);
          return from.length > 0 ? exsolve.resolveModulePath(id, { ...opts, from }) : undefined;
        }) as typeof exsolve.resolveModulePath,
      };
    });
    const { importOXC } = await loadOXC();
    const oxc = await importOXC({ dir: rootDir });
    expect(oxc.minifySync).toBeTypeOf("function");
  });

  it("falls back to oxbox when rolldown is not installed", async () => {
    withoutRolldown();
    const { importOXC } = await loadOXC();
    const oxbox = await import("oxbox");
    const { parseSync, transformSync, minifySync } = await importOXC({ dir: rootDir });
    expect(parseSync).toBe(oxbox.parseSync);
    expect(minifySync).toBeUndefined();
    expect(transformSync("index.ts", "const a: number = 1").code).toBe("const a = 1;\n");

    // Output plugins without access to the project root reuse the last loaded instance
    expect((await importOXC()).parseSync).toBe(oxbox.parseSync);
    const { cloudflareOutputRewrites } =
      await import("../../src/presets/cloudflare/output-plugins.ts");
    const input = `import "node:buffer";
import { createRequire as e } from "node:module";
const greeting = "héllo 😀";
const r = e(import.meta.url);
export { greeting, r };
`;
    expect(await renderChunk(cloudflareOutputRewrites(), input)).toBe(`
import { createRequire as e } from "node:module";
const greeting = "héllo 😀";
const r = e(import.meta.url || "file:///");
export { greeting, r };
`);
  });

  it("skips minification with a warning when rolldown is not installed", async () => {
    withoutRolldown();
    vi.resetModules();
    const { oxc } = await import("../../src/build/plugins/oxc.ts");
    const warn = vi.fn();
    const nitro = { options: { rootDir }, logger: { warn } } as unknown as Nitro;
    const plugin = await oxc(nitro, { sourcemap: false, minify: true });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Skipping minification"));
    const input = "const a = 1;\nexport { a };\n";
    expect(await renderChunk(plugin, input)).toBe(input);
  });
});

async function renderChunk(plugin: Plugin, code: string): Promise<string> {
  const hook = plugin.renderChunk;
  const handler = typeof hook === "function" ? hook : hook!.handler;
  const result = await handler.call(
    { warn: (warning: unknown) => expect.fail(String(warning)) } as unknown as PluginContext,
    code,
    { fileName: "index.mjs" } as RenderedChunk,
    { sourcemap: false } as NormalizedOutputOptions,
    { chunks: {} }
  );
  return typeof result === "string" ? result : (result?.code ?? code);
}
