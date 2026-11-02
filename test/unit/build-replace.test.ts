import { describe, expect, it } from "vitest";
import type { ObjectHook, Plugin, TransformPluginContext, TransformResult } from "rollup";
import { replace } from "../../src/build/plugins/replace.ts";

type TransformHook = Extract<NonNullable<Plugin["transform"]>, { handler: unknown }>;

const ctx = {} as TransformPluginContext;

describe("replace plugin", () => {
  it("adds a `code` filter matching the escaped keys", () => {
    const plugin = replace({ "import.meta.dev": "false", "process.env.$KEY": '"value"' });
    const { filter } = plugin.transform as TransformHook;
    const code = filter!.code as RegExp;
    expect(code.test("if (import.meta.dev) {}")).toBe(true);
    expect(code.test("process.env.$KEY")).toBe(true);
    expect(code.test("import.meta_dev")).toBe(false);
    expect(code.test("process.env.KEY")).toBe(false);
    expect(code.test("export const value = 1;")).toBe(false);
  });

  it("keeps replacing in modules matching the filter", async () => {
    const plugin = replace({ "import.meta.dev": "false" });
    const { handler } = plugin.transform as TransformHook;
    const result = (await handler.call(ctx, "if (import.meta.dev) {}", "/src/index.ts")) as Exclude<
      TransformResult,
      string
    >;
    expect(result?.code).toBe("if (false) {}");
  });

  it("does not replace in raw modules", async () => {
    const plugin = replace({ "import.meta.dev": "false" });
    const { handler } = plugin.transform as TransformHook;
    const result = await handler.call(
      ctx,
      'export default "import.meta.dev"',
      "\0virtual:nitro:raw:/src/file.txt.js"
    );
    expect(result).toBeNull();
  });

  it("does not add a filter without keys", () => {
    const plugin = replace({});
    expect(typeof (plugin.transform as ObjectHook<unknown>)).toBe("function");
  });

  it("does not replace in chunks", () => {
    expect(replace({ "import.meta.dev": "false" }).renderChunk).toBeUndefined();
  });
});
