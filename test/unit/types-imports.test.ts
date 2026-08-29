import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolveModulePath } from "exsolve";
import { dirname, join } from "pathe";
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

  it("emits a bare specifier for an `exports` subpath with no matching file on disk", async () => {
    const { specifier } = await generateForPackage({
      name: "subpath-exports-pkg",
      exports: {
        ".": "./dist/index.js",
        "./utils": { types: "./dist/utils.d.ts", import: "./dist/utils.js" },
      },
      files: {
        "dist/index.js": "export {}\n",
        "dist/utils.js": "export function useSubpathExports() { return true }\n",
        "dist/utils.d.ts": "export declare function useSubpathExports(): boolean\n",
      },
      from: "subpath-exports-pkg/utils",
      imports: ["useSubpathExports"],
    });

    expect(specifier).toBe("subpath-exports-pkg/utils");
  });

  it("emits a resolvable specifier for a subpath only reachable through wildcard `exports`", async () => {
    const { specifier, rootDir } = await generateForPackage({
      name: "wildcard-exports-pkg",
      exports: {
        ".": "./dist/index.js",
        "./drivers/*": "./dist/drivers/*.js",
      },
      files: {
        "dist/index.js": "export {}\n",
        "dist/drivers/fs.js": "export function useWildcardDriver() { return true }\n",
        "dist/drivers/fs.d.ts": "export declare function useWildcardDriver(): boolean\n",
      },
      from: "wildcard-exports-pkg/drivers/fs",
      imports: ["useWildcardDriver"],
    });

    const generatedTypesDir = join(rootDir, "node_modules", ".nitro", "types");
    expect(
      resolveModulePath(specifier, {
        try: true,
        from: join(generatedTypesDir, "nitro-imports.d.ts"),
        conditions: ["types", "import"],
        extensions: ["", ".d.ts", ".js"],
      }),
      `specifier ${specifier} should be resolvable`
    ).toBeTruthy();
  });
});

async function generateForPackage(options: {
  name: string;
  exports: unknown;
  files: Record<string, string>;
  from: string;
  imports: string[];
}) {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-types-"));
  const pkgDir = join(rootDir, "node_modules", options.name);
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(
    join(pkgDir, "package.json"),
    JSON.stringify({ name: options.name, type: "module", exports: options.exports })
  );
  for (const [file, contents] of Object.entries(options.files)) {
    mkdirSync(dirname(join(pkgDir, file)), { recursive: true });
    writeFileSync(join(pkgDir, file), contents);
  }

  mkdirSync(join(rootDir, "server"), { recursive: true });
  writeFileSync(join(rootDir, "server", "package.json"), '{ "type": "module" }\n');

  const nitro = await createNitro({
    rootDir,
    builder: "rolldown",
    imports: {
      presets: [{ from: options.from, imports: options.imports }],
    },
  });

  await writeTypes(nitro);

  const generated = readFileSync(
    join(rootDir, "node_modules", ".nitro", "types", "nitro-imports.d.ts"),
    "utf8"
  );
  const match = generated.match(new RegExp(`typeof import\\('([^']*${options.name}[^']*)'\\)`));
  expect(match, `expected import() referencing ${options.name} in:\n${generated}`).toBeTruthy();

  return { specifier: match![1]!, generated, rootDir };
}
