#!/usr/bin/env node
import { execSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { colors } from "consola/utils";
import { dirname, join, relative } from "pathe";

const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("-")));

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const localDist = join(rootDir, "dist");

if (!existsSync(localDist)) {
  console.error(colors.red(`Local dist/ not found at ${localDist}. Run \`pnpm build\` first.`));
  process.exit(1);
}

const tag = args[0] || "latest";
const pkgSpec = `nitro@${tag}`;

console.log(`${colors.cyan("Resolving")} ${colors.bold(pkgSpec)}...`);
const version = execSync(`npm view ${pkgSpec} version`, { encoding: "utf8" }).trim();
console.log(`${colors.dim("Released version:")} ${colors.green(colors.bold(version))}`);

const workDir = mkdtempSync(join(tmpdir(), "nitro-diff-dist-"));
console.log(
  `${colors.cyan("Downloading")} ${colors.bold(`nitro@${version}`)} ${colors.dim(`-> ${workDir}`)}`
);
execSync(`npm pack nitro@${version} --silent`, { cwd: workDir, stdio: "inherit" });

const tarball = execSync(`ls ${workDir}/*.tgz`, { encoding: "utf8" }).trim();
execSync(`tar -xzf ${tarball} -C ${workDir}`, { stdio: "inherit" });

const releasedDist = join(workDir, "package", "dist");
if (!existsSync(releasedDist)) {
  console.error(colors.red(`No dist/ found in published nitro@${version}`));
  rmSync(workDir, { recursive: true, force: true });
  process.exit(1);
}

const localDistCopy = join(workDir, "local-dist");
execSync(`cp -R ${JSON.stringify(localDist)} ${JSON.stringify(localDistCopy)}`);

decompressGzInPlace(releasedDist);
decompressGzInPlace(localDistCopy);

console.log(
  `\n${colors.cyan("Diffing")} released ${colors.bold(`nitro@${version}`)} vs local ${colors.bold("dist/")}\n`
);

const stdout = flags.has("--stdout");
const outDir = join(rootDir, ".tmp");
const outPath = stdout ? null : join(outDir, "diff.patch");

const result = spawnSync("diff", ["-ruN", releasedDist, localDistCopy], {
  encoding: "utf8",
  maxBuffer: 256 * 1024 * 1024,
});

const patch = result.stdout || "";

if (result.status === 0) {
  console.log(colors.green("No differences found."));
  rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
}

if (result.status !== 1) {
  console.error(colors.red(result.stderr));
  process.exit(result.status ?? 1);
}

if (stdout) {
  process.stdout.write(patch);
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath!, patch);

  const treeDir = join(outDir, "diff");
  rmSync(treeDir, { recursive: true, force: true });
  const entries = writeDiffTree(patch, treeDir, releasedDist, localDistCopy);

  console.log(colors.bold(colors.magenta("Changed files:")));
  const relWidth = Math.max(...entries.map((e) => e.rel.length));
  for (const entry of entries) {
    console.log(
      `  ${colors.dim(entry.rel.padEnd(relWidth))}  ${colors.cyan(relative(rootDir, entry.target))}`
    );
  }
  console.log(
    `\n${colors.dim("Wrote unified diff to")} ${colors.cyan(relative(rootDir, outPath!))}`
  );
}

rmSync(workDir, { recursive: true, force: true });

function decompressGzInPlace(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      decompressGzInPlace(full);
    } else if (entry.isFile() && entry.name.endsWith(".gz")) {
      writeFileSync(full.slice(0, -3), gunzipSync(readFileSync(full)));
      unlinkSync(full);
    }
  }
}

function writeDiffTree(
  fullPatch: string,
  treeDir: string,
  releasedRoot: string,
  localRoot: string
): { rel: string; target: string }[] {
  const entries: { rel: string; target: string }[] = [];
  const sections = fullPatch.split(/^(?=diff -ruN )/m).filter(Boolean);
  for (const section of sections) {
    const header = section.split("\n", 1)[0];
    // diff -ruN <released-path> <local-path>
    const match = header.match(/^diff -ruN (\S+) (\S+)$/);
    if (!match) continue;
    const [, releasedPath, localPath] = match;
    const rel = relative(releasedRoot, releasedPath) || relative(localRoot, localPath);
    if (!rel || rel.startsWith("..")) continue;
    const target = join(treeDir, `${rel}.patch`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, section);
    entries.push({ rel, target });
  }
  return entries;
}
