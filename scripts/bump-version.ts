#!/bin/env node
import { promises as fsp } from "node:fs";
import { resolve } from "pathe";

const c = {
  cyan: (s: string) => `\x1B[36m${s}\x1B[0m`,
  green: (s: string) => `\x1B[32m${s}\x1B[0m`,
  yellow: (s: string) => `\x1B[33m${s}\x1B[0m`,
  gray: (s: string) => `\x1B[90m${s}\x1B[0m`,
  red: (s: string) => `\x1B[31m${s}\x1B[0m`,
  bold: (s: string) => `\x1B[1m${s}\x1B[0m`,
};

function fmtDate(d: Date): string {
  const y = d.getFullYear() % 100;
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}${m}${day}`;
}

async function fetchExistingVersions(pkgName: string): Promise<string[]> {
  const url = `https://registry.npmjs.org/${pkgName}`;
  console.log(c.gray(`Fetching versions from npm registry for ${c.cyan(pkgName)}...`));
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(c.yellow(`  Registry returned ${res.status}, assuming first release`));
      return [];
    }
    const data = (await res.json()) as { versions?: Record<string, unknown> };
    const versions = Object.keys(data.versions || {});
    return versions;
  } catch (err) {
    console.log(c.yellow(`  Failed to fetch registry: ${err}`));
    return [];
  }
}

async function resolveDateSuffix(pkgName: string, dateStr: string): Promise<string> {
  const versions = await fetchExistingVersions(pkgName);
  const prefix = `3.0.${dateStr}-beta`;
  const matching = versions.filter((v) => v.startsWith(prefix));

  if (matching.length === 0) {
    console.log(c.gray(`  No existing releases for ${c.cyan(dateStr)}`));
    return dateStr;
  }

  let max = 0;
  for (const v of matching) {
    const rest = v.slice(prefix.length);
    if (rest === "") {
      max = Math.max(max, 1);
    } else if (rest.startsWith(".")) {
      const n = Number.parseInt(rest.slice(1), 10);
      if (!Number.isNaN(n)) {
        max = Math.max(max, n);
      }
    }
  }

  const suffix = `${dateStr}.${max + 1}`;
  console.log(c.gray(`  Using suffix ${c.cyan(suffix)}`));
  return suffix;
}

async function main() {
  console.log(c.bold("\nBump version to beta\n"));

  const pkgPath = resolve(process.cwd(), "package.json");
  const pkg = JSON.parse(await fsp.readFile(pkgPath, "utf8"));
  const oldVersion = pkg.version;

  const dateStr = fmtDate(new Date());
  console.log(c.gray(`Date: ${c.cyan(dateStr)}`));

  const suffix = await resolveDateSuffix(pkg.name, dateStr);
  const newVersion = `3.0.${suffix}-beta`;

  console.log();
  console.log(`  ${c.cyan(pkg.name)} ${c.gray(oldVersion)} → ${c.green(newVersion)}`);

  pkg.version = newVersion;
  await fsp.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  console.log(c.green(`\nDone!\n`));
}

main().catch((error) => {
  console.error(c.red(`\nError: ${error.message}\n`));
  process.exit(1);
});
