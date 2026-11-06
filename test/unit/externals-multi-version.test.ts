import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { dirname, join } from "pathe";
import { rollup } from "rollup";
import { afterAll, describe, expect, it } from "vitest";
import { externals } from "../../src/rollup/plugins/externals";

describe("externals: package traced in several versions", () => {
  let rootDir: string;

  afterAll(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  // The app imports `zod` 4.6.5, as does `peer-user` (peer dependency).
  // `pinned-user` has its own `zod` 4.6.7 and imports only `zod/v4`.
  it("links the version the bundle imports to the top level", async () => {
    rootDir = await mkdtemp(join(tmpdir(), "nitro-externals-multi-version-"));
    const files: Record<string, string> = {
      "index.mjs": [
        `import { version } from "zod";`,
        `import { peer } from "peer-user";`,
        `import { pinned } from "pinned-user";`,
        `export default { app: version, peer, pinned };`,
      ].join("\n"),
      "node_modules/zod/package.json": zodPackage("4.6.5"),
      "node_modules/zod/index.js": `export const version = "4.6.5";`,
      "node_modules/zod/v4/index.js": `export const version = "4.6.5/v4";`,
      "node_modules/peer-user/package.json": userPackage("peer-user"),
      "node_modules/peer-user/index.js": `export { version as peer } from "zod";`,
      "node_modules/pinned-user/package.json": userPackage("pinned-user"),
      "node_modules/pinned-user/index.js": `export { version as pinned } from "zod/v4";`,
      "node_modules/pinned-user/node_modules/zod/package.json":
        zodPackage("4.6.7"),
      "node_modules/pinned-user/node_modules/zod/index.js": `export const version = "4.6.7";`,
      "node_modules/pinned-user/node_modules/zod/v4/index.js": `export const version = "4.6.7/v4";`,
    };
    for (const [path, contents] of Object.entries(files)) {
      await mkdir(dirname(join(rootDir, path)), { recursive: true });
      await writeFile(join(rootDir, path), contents);
    }

    const outDir = join(rootDir, ".output/server");
    const bundle = await rollup({
      input: join(rootDir, "index.mjs"),
      plugins: [
        externals({
          rootDir,
          outDir,
          moduleDirectories: [join(rootDir, "node_modules")],
          exportConditions: ["node", "import", "default"],
          traceOptions: { base: "/", processCwd: rootDir, exportsOnly: true },
        }),
      ],
    });
    await bundle.write({ file: join(outDir, "index.mjs"), format: "esm" });

    const { default: result } = await import(
      pathToFileURL(join(outDir, "index.mjs")).href
    );
    expect(result).toEqual({ app: "4.6.5", peer: "4.6.5", pinned: "4.6.7/v4" });
    // Compare real paths: on Windows the link is a junction, which stores an absolute target
    expect(await realpath(join(outDir, "node_modules/zod"))).toBe(
      await realpath(join(outDir, "node_modules/.nitro/zod@4.6.5"))
    );
  });
});

function zodPackage(version: string) {
  return JSON.stringify({
    name: "zod",
    version,
    type: "module",
    exports: { ".": "./index.js", "./v4": "./v4/index.js" },
  });
}

function userPackage(name: string) {
  return JSON.stringify({
    name,
    version: "1.0.0",
    type: "module",
    exports: "./index.js",
  });
}
