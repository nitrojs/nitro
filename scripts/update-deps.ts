#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));

let outdated: string;
try {
  outdated = execSync("pnpm outdated", { encoding: "utf8", stdio: "pipe" });
} catch (error: any) {
  // pnpm outdated exits with code 1 when there are outdated deps
  outdated = error.stdout || "";
  if (!outdated) {
    console.error("Failed to run pnpm outdated");
    process.exit(1);
  }
}

const updates: { name: string; current: string; latest: string }[] = [];

for (const line of outdated.split("\n")) {
  // Match: │ pkg (dev) │ 1.2.3 (wanted 1.2.0) │ 1.3.0 │
  const match = line.match(
    /│\s+(\S+?)(?:\s+\(dev\))?\s+│\s+(\S+)(?:\s+\(wanted\s+(\S+)\))?\s+│\s+(\S+)\s+│/
  );
  if (!match) continue;
  const [, name, installed, wanted, latest] = match;
  if (name === "Package") continue;
  // "wanted" is the version in package.json (when installed differs from spec)
  // If no "wanted", the installed version matches the spec
  const current = wanted || installed;
  if (current === latest) continue;
  updates.push({ name, current, latest });
}

if (updates.length === 0) {
  console.log("All dependencies are up to date.");
  process.exit(0);
}

let pkg = readFileSync(pkgPath, "utf8");
let applied = 0;
const skipped: string[] = [];

for (const { name, current, latest } of updates) {
  const currentMajor = current.split(".")[0];
  const latestMajor = latest.split(".")[0];

  // Skip major version bumps (unless pre-release like 0.x or rc)
  if (currentMajor !== latestMajor && Number(currentMajor) > 0 && Number(latestMajor) > 0) {
    skipped.push(`${name} ${current} → ${latest} (major)`);
    continue;
  }

  // Escape special regex characters in the version string
  const escaped = current.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Match both "^version" and "npm:pkg@^version" patterns
  const re = new RegExp(`("${name.replaceAll("/", "\\/")}":\\s*"(?:npm:[^@]+@)?\\^)${escaped}"`);

  const updated = pkg.replace(re, `$1${latest}"`);
  if (updated !== pkg) {
    pkg = updated;
    applied++;
    console.log(`  ${name}: ${current} → ${latest}`);
  } else {
    skipped.push(`${name} ${current} → ${latest} (no match in package.json)`);
  }
}

if (applied > 0) {
  writeFileSync(pkgPath, pkg);
  console.log(`\nUpdated ${applied} dependencies.`);
}

if (skipped.length > 0) {
  console.log(`\nSkipped:`);
  for (const s of skipped) {
    console.log(`  ${s}`);
  }
}

if (applied > 0) {
  const rootDir = fileURLToPath(new URL("..", import.meta.url));
  const run = (cmd: string) => execSync(cmd, { stdio: "inherit", cwd: rootDir });

  console.log("\nRunning pnpm install...");
  run("rm -f pnpm-lock.yaml && pnpm install");

  console.log("\nRunning pnpm build...");
  run("pnpm build");

  console.log("\nRunning pnpm build --stub...");
  run("pnpm build --stub");

  console.log("\nRunning pnpm format...");
  run("pnpm format");

  console.log("\nRunning pnpm test...");
  run("pnpm test");
}
