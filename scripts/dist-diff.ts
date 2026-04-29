#!/usr/bin/env node
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "pathe";

const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("-")));

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const localDist = join(rootDir, "dist");

if (!existsSync(localDist)) {
  console.error(`Local dist/ not found at ${localDist}. Run \`pnpm build\` first.`);
  process.exit(1);
}

const tag = args[0] || "latest";
const pkgSpec = `nitro@${tag}`;

console.log(`Resolving ${pkgSpec}...`);
const version = execSync(`npm view ${pkgSpec} version`, { encoding: "utf8" }).trim();
console.log(`Released version: ${version}`);

const workDir = mkdtempSync(join(tmpdir(), "nitro-diff-dist-"));
console.log(`Downloading nitro@${version} to ${workDir}...`);
execSync(`npm pack nitro@${version} --silent`, { cwd: workDir, stdio: "inherit" });

const tarball = execSync(`ls ${workDir}/*.tgz`, { encoding: "utf8" }).trim();
execSync(`tar -xzf ${tarball} -C ${workDir}`, { stdio: "inherit" });

const releasedDist = join(workDir, "package", "dist");
if (!existsSync(releasedDist)) {
  console.error(`No dist/ found in published nitro@${version}`);
  rmSync(workDir, { recursive: true, force: true });
  process.exit(1);
}

console.log(`\nDiffing released nitro@${version} vs local dist/\n`);

const stdout = flags.has("--stdout");
const outDir = join(rootDir, ".tmp");
const outPath = stdout ? null : join(outDir, `dist-diff-${version}.patch`);

const result = spawnSync("diff", ["-ruN", releasedDist, localDist], {
  encoding: "utf8",
  maxBuffer: 256 * 1024 * 1024,
});

const patch = result.stdout || "";

if (result.status === 0) {
  console.log("No differences found.");
  rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
}

if (result.status !== 1) {
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

const summary = execSync(`diff -r --brief ${releasedDist} ${localDist} || true`, {
  encoding: "utf8",
});
console.log(summary);

if (stdout) {
  process.stdout.write(patch);
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath!, patch);
  console.log(
    `Wrote unified diff to ${relative(rootDir, outPath!)} (${(patch.length / 1024).toFixed(1)} KB)`
  );

  const treeDir = join(outDir, "diff");
  rmSync(treeDir, { recursive: true, force: true });
  const written = writeDiffTree(patch, treeDir, releasedDist, localDist);
  console.log(`Wrote ${written} per-file diffs to ${relative(rootDir, treeDir)}/`);
}

console.log(`\nReleased dist kept at: ${releasedDist}`);
console.log(`Cleanup:\n  rm -rf ${workDir}`);

function writeDiffTree(
  fullPatch: string,
  treeDir: string,
  releasedRoot: string,
  localRoot: string
): number {
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
  }
  return sections.length;
}
