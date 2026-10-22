// @ts-nocheck Bun APIs (no `@types/bun`)
// Entry of the single binary: extracts the embedded payload (`node_modules` with nitro and its
// dependencies) once into a versioned cache directory, then runs the CLI from there, as builders
// need the runtime files and dependencies on the real filesystem.
import { existsSync, readFileSync } from "node:fs";
import { chmod, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";

// Generated at build time
import payload from "./payload.tar.gz" with { type: "file" };
import { id } from "./payload.ts";

const cacheDir = join(
  process.env.NITRO_BIN_CACHE_DIR ||
    join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "nitro", "bin"),
  id
);

if (!existsSync(join(cacheDir, ".ready"))) {
  const tmpDir = `${cacheDir}.${process.pid}.tmp`;
  await mkdir(tmpDir, { recursive: true });
  await new Bun.Archive(await Bun.file(payload).bytes()).extract(tmpDir);
  // `bun` command running this binary as Bun, to install builders in projects without a package manager
  await mkdir(join(tmpDir, "bin"));
  await writeFile(join(tmpDir, "bin/bun"), `#!/bin/sh\nBUN_BE_BUN=1 exec "$NITRO_BIN" "$@"\n`);
  await chmod(join(tmpDir, "bin/bun"), 0o755);
  await writeFile(join(tmpDir, ".ready"), "");
  await rename(tmpDir, cacheDir).catch(async (error) => {
    await rm(tmpDir, { recursive: true, force: true });
    if (!existsSync(join(cacheDir, ".ready"))) {
      throw error;
    }
  });
}

process.env.NITRO_BIN = process.execPath;
process.env.PATH = [process.env.PATH, join(cacheDir, "bin")].filter(Boolean).join(delimiter);

// Project files (e.g. `nitro.config.ts`) import `nitro` without it being installed. Bun runtime
// plugins cannot resolve bare specifiers, so they are rewritten to the embedded package instead.
Bun.plugin({
  name: "nitro-bin:self",
  setup(build) {
    build.onLoad({ filter: /^(?!.*[/\\]node_modules[/\\]).*\.[cm]?[jt]sx?$/ }, ({ path }) => ({
      loader: path.match(/([jt]sx?)$/)![1] as "js" | "jsx" | "ts" | "tsx",
      contents: readFileSync(path, "utf8").replace(
        /((?:from|import)\s*\(?\s*)(["'])(nitro(?:\/[^"']*)?)\2/g,
        (_, prefix, _quote, id) =>
          prefix + JSON.stringify(pathToFileURL(Bun.resolveSync(id, cacheDir)).href)
      ),
    }));
  },
});

await import(pathToFileURL(join(cacheDir, "node_modules/nitro/dist/cli/index.mjs")).href);
