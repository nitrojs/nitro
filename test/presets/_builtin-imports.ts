import { promises as fsp } from "node:fs";
import { resolve } from "pathe";
import { expect, it } from "vitest";
import type { Context } from "../tests.ts";

/**
 * Assert that builtins imported by their bare id (`events`, `buffer/`) are externalized with
 * their `node:` id in the server output.
 */
export function testBuiltinImports(ctx: Context) {
  it("externalizes builtins imported by their bare id with the `node:` prefix", async () => {
    const serverDir = ctx.nitro!.options.output.serverDir;
    const files = (await fsp.readdir(serverDir, { recursive: true })).filter((f) =>
      f.endsWith(".mjs")
    );
    const code = (
      await Promise.all(files.map((f) => fsp.readFile(resolve(serverDir, f), "utf8")))
    ).join("\n");
    expect(code).toMatch(/["']node:events["']/);
    expect(code).toMatch(/["']node:buffer["']/);
    expect(code).not.toMatch(/(?:from|import|require\()\s*["'`](?:events|buffer\/)["'`]/);
  });
}
