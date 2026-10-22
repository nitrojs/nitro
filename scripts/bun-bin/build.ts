#!/usr/bin/env bun
// @ts-nocheck Bun APIs (no `@types/bun`)
// Bundle the built nitro package (`pnpm build` first) into a single Bun executable.
//
// The binary embeds a production `node_modules` (packed nitro, its dependencies and unenv)
// extracted on first run by `launcher.ts`. Builders are installed in the project when needed.
//
// Usage: bun scripts/bun-bin/build.ts [--target=bun-linux-x64]
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { $ } from "bun";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));
const outDir = join(rootDir, ".build-bin");
const stageDir = join(outDir, "stage");

const target = process.argv.find((arg) => arg.startsWith("--target="))?.slice("--target=".length);
const [, os, cpu] = target?.match(/^bun-(\w+)-(\w+)/) || [];

const pkg = await Bun.file(join(rootDir, "package.json")).json();
const { deps } = await Bun.file(join(rootDir, "deps.json")).json();

await rm(stageDir, { recursive: true, force: true });
await mkdir(stageDir, { recursive: true });

// Production install of the packed package
await $`pnpm pack --pack-destination ${stageDir}`.cwd(rootDir).quiet();
const tarball = `nitro-${pkg.version}.tgz`;
await writeFile(
  join(stageDir, "package.json"),
  JSON.stringify({
    private: true,
    dependencies: {
      nitro: `file:./${tarball}`,
      unenv: deps.unenv.version,
    },
  })
);
const platformFlags = [...(os ? [`--os=${os}`] : []), ...(cpu ? [`--cpu=${cpu}`] : [])];
await $`bun install --production --no-save --ignore-scripts ${platformFlags}`.cwd(stageDir);

// Payload archive
const files: Record<string, Blob> = {};
for (const entry of await readdir(join(stageDir, "node_modules"), {
  recursive: true,
  withFileTypes: true,
})) {
  const path = join(entry.parentPath, entry.name);
  const rel = relative(stageDir, path);
  if (!entry.isFile() || rel.startsWith("node_modules/.") || /\.(d\.[mc]?ts|map)$/.test(rel)) {
    continue;
  }
  files[rel] = new Blob([await Bun.file(path).bytes()]);
}
const archive = await new Bun.Archive(files, { compress: "gzip" }).bytes();
await Bun.write(join(stageDir, "payload.tar.gz"), archive);
const hash = new Bun.CryptoHasher("sha256").update(archive).digest("hex").slice(0, 8);
await writeFile(
  join(stageDir, "payload.ts"),
  `export const id = ${JSON.stringify(`${pkg.version}-${hash}`)};\n`
);
await cp(join(import.meta.dirname, "launcher.ts"), join(stageDir, "launcher.ts"));

// Single executable
const outfile = join(outDir, target ? `nitro-${target.replace(/^bun-/, "")}` : "nitro");
await $`bun build --compile --minify --compile-autoload-package-json --no-compile-autoload-dotenv --no-compile-autoload-bunfig ${target ? [`--target=${target}`] : []} ${join(stageDir, "launcher.ts")} --outfile ${outfile}`;

console.log(
  `\n${relative(rootDir, outfile)} (payload: ${(archive.byteLength / 1024 / 1024).toFixed(1)} MB, ${Object.keys(files).length} files)`
);
