import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { describe, expect, it } from "vitest";
import { createNitro, writeTypes } from "nitro/builder";

describe("writeTypes auto-import resolution", () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), "nitro-types-"));

  it("emits a file path (not a package directory) for packages whose exports map only `.`", async () => {
    const pkgDir = join(fixtureDir, "node_modules", "exports-only-pkg");
    mkdirSync(join(pkgDir, "dist"), { recursive: true });
    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({
        name: "exports-only-pkg",
        type: "module",
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js",
          },
        },
      })
    );
    writeFileSync(
      join(pkgDir, "dist", "index.js"),
      "export function useExportsOnly() { return true }\n"
    );
    writeFileSync(
      join(pkgDir, "dist", "index.d.ts"),
      "export declare function useExportsOnly(): boolean\n"
    );

    mkdirSync(join(fixtureDir, "server"), { recursive: true });
    writeFileSync(join(fixtureDir, "server", "package.json"), '{ "type": "module" }\n');

    const nitro = await createNitro({
      rootDir: fixtureDir,
      builder: "rolldown",
      imports: {
        presets: [
          {
            from: "exports-only-pkg",
            imports: ["useExportsOnly"],
          },
        ],
      },
    });

    await writeTypes(nitro);

    const generated = readFileSync(
      join(fixtureDir, "node_modules", ".nitro", "types", "nitro-imports.d.ts"),
      "utf8"
    );

    const match = generated.match(/typeof import\('([^']*exports-only-pkg[^']*)'\)/);
    expect(match, `expected import() referencing exports-only-pkg in:\n${generated}`).toBeTruthy();
    const specifier = match![1]!;
    expect(
      specifier.endsWith("exports-only-pkg"),
      `specifier should not end at the package directory, got ${specifier}`
    ).toBe(false);
  });
});
