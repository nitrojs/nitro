import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guessSubpath } from "../../src/build/plugins/externals.ts";

describe("guessSubpath", () => {
  let root: string;
  let dep: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "nitro-guess-subpath-"));
    dep = join(root, "node_modules", "dep");
    mkdirSync(join(dep, "dist", "features"), { recursive: true });
    writeFileSync(
      join(dep, "package.json"),
      JSON.stringify({
        name: "dep",
        version: "1.0.0",
        type: "module",
        exports: {
          ".": { import: "./dist/index.mjs", require: "./dist/index.cjs" },
          "./sub": "./dist/sub.mjs",
          "./features/*": "./dist/features/*.mjs",
        },
      })
    );
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("maps the package's own entry to the bare package name", () => {
    expect(guessSubpath(join(dep, "dist", "index.mjs"), ["import", "default"])).toBe("dep");
  });

  it("maps a named subpath export", () => {
    expect(guessSubpath(join(dep, "dist", "sub.mjs"), ["import", "default"])).toBe("dep/sub");
  });

  it("maps a wildcard subpath export", () => {
    expect(guessSubpath(join(dep, "dist", "features", "x.mjs"), ["import", "default"])).toBe(
      "dep/features/x"
    );
  });

  it("respects the resolve conditions", () => {
    expect(guessSubpath(join(dep, "dist", "index.cjs"), ["import", "default"])).toBeUndefined();
    expect(guessSubpath(join(dep, "dist", "index.cjs"), ["require", "default"])).toBe("dep");
  });

  it("gives up outside node_modules or for files no export points at", () => {
    expect(guessSubpath(join(root, "src", "index.mjs"), ["import"])).toBeUndefined();
    expect(guessSubpath(join(dep, "dist", "other.mjs"), ["import", "default"])).toBeUndefined();
  });
});
