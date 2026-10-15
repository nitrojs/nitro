import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SourceMapGenerator } from "source-map";

const sourceMapStats = vi.hoisted(() => ({ created: 0, destroyed: 0 }));

vi.mock("source-map", async (importOriginal) => {
  const mod = await importOriginal<typeof import("source-map")>();
  function SourceMapConsumer(this: unknown, raw: any) {
    sourceMapStats.created++;
    return (new mod.SourceMapConsumer(raw) as any).then((consumer: any) => {
      const destroy = consumer.destroy.bind(consumer);
      consumer.destroy = () => {
        sourceMapStats.destroyed++;
        destroy();
      };
      return consumer;
    });
  }
  return { ...mod, SourceMapConsumer };
});

const { loadStackTrace } = await import("../../src/runtime/internal/error/dev");

describe("dev error handler: source maps", () => {
  let dir: string;
  let bundle: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "nitro-dev-sourcemap-"));
    bundle = join(dir, "index.mjs");
    await writeFile(bundle, Array.from({ length: 5 }, () => "x();").join("\n"));
    const map = new SourceMapGenerator({ file: "index.mjs" });
    for (let line = 1; line <= 5; line++) {
      map.addMapping({
        source: "../src/handler.ts",
        generated: { line, column: 0 },
        original: { line: line * 10, column: 2 },
      });
    }
    await writeFile(`${bundle}.map`, map.toString());
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("parses the bundle source map once per error", async () => {
    const error = new Error("boom");
    error.stack = [
      "Error: boom",
      ...Array.from(
        { length: 5 },
        (_, i) => `    at fn${i} (${bundle}:${i + 1}:1)`
      ),
    ].join("\n");

    sourceMapStats.created = 0;
    sourceMapStats.destroyed = 0;
    await loadStackTrace(error);

    expect(sourceMapStats.created).toBe(1);
    expect(sourceMapStats.destroyed).toBe(1);
    const original = join(dir, "../src/handler.ts");
    for (let i = 0; i < 5; i++) {
      expect(error.stack).toContain(`${original}:${(i + 1) * 10}:2`);
    }
  });

  it("keeps the original frame when the source map is invalid", async () => {
    const brokenBundle = join(dir, "broken.mjs");
    await writeFile(brokenBundle, "x();");
    await writeFile(`${brokenBundle}.map`, "{ not json");

    const error = new Error("boom");
    error.stack = `Error: boom\n    at fn (${brokenBundle}:1:1)`;
    await expect(loadStackTrace(error)).resolves.toBeUndefined();
    expect(error.stack).toContain(`${brokenBundle}:1:1`);
  });
});
