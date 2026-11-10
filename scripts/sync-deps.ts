#!/usr/bin/env node
// Sync the supported ranges of `deps.json` with the tested versions (`devDependencies`).
//
// A range is only updated once the tested version is out of it (e.g. a new major), keeping its
// precision (`^8` → `^9`). Ranges of several majors (`^17 || ^18`) get the new one appended.
// Shim ranges must stay within the peer range of the library they belong to.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { consola } from "consola";
import { readPackageJSON } from "pkg-types";
import { lt, minVersion, parse, satisfies, subset } from "semver";

type Entry = { version: string; library?: string };

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = fileURLToPath(new URL("../deps.json", import.meta.url));

const pkg = await readPackageJSON(rootDir);
let source = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(source) as Record<string, Record<string, Entry>>;

const updates: string[] = [];
const errors: string[] = [];

for (const [section, entries] of Object.entries(manifest)) {
  for (const [id, { version: range, library }] of Object.entries(entries)) {
    const testedRange = pkg.devDependencies?.[id];
    const tested = testedRange && minVersion(testedRange)?.version;
    if (!tested) {
      errors.push(`\`${id}\` is not in \`devDependencies\`.`);
      continue;
    }
    if (satisfies(tested, range, { includePrerelease: true })) {
      continue;
    }
    if (lt(tested, minVersion(range)!)) {
      errors.push(`\`${id}\`: tested version \`${tested}\` is lower than \`${range}\`.`);
      continue;
    }
    const version = syncRange(range, tested);
    if (library) {
      const peerRange = (await readPackageJSON(library, { url: rootDir })).peerDependencies?.[id];
      if (!peerRange || !subset(version, peerRange, { includePrerelease: true })) {
        errors.push(`\`${id}\`: \`${version}\` is out of the range \`${library}\` accepts.`);
        continue;
      }
    }
    source = source.replace(
      new RegExp(`("${escapeRegExp(id)}":\\s*\\{[^}]*?"version":\\s*)"${escapeRegExp(range)}"`),
      `$1"${version}"`
    );
    updates.push(`${section}.${id}: ${range} → ${version}`);
  }
}

if (updates.length > 0) {
  writeFileSync(manifestPath, source);
  consola.success(`Updated \`deps.json\`:\n${updates.map((u) => `  ${u}`).join("\n")}`);
} else {
  consola.info("`deps.json` ranges cover the tested versions.");
}

if (errors.length > 0) {
  consola.error(errors.join("\n"));
  process.exit(1);
}

function syncRange(range: string, version: string): string {
  const ranges = range.split("||").map((r) => r.trim());
  const caret = `^${trimVersion(version, ranges.at(-1)!)}`;
  return ranges.length > 1 ? `${range} || ${caret}` : caret;
}

/** Trim `version` to the precision of `like` (`^8`), as long as it stays a caret range of it. */
function trimVersion(version: string, like: string): string {
  const parsed = parse(version)!;
  if (parsed.prerelease.length > 0) {
    return version;
  }
  const precision = like.replace(/^\^/, "").split("-")[0]!.split(".").length;
  const needed = parsed.major > 0 ? 1 : parsed.minor > 0 ? 2 : 3;
  return [parsed.major, parsed.minor, parsed.patch].slice(0, Math.max(precision, needed)).join(".");
}

function escapeRegExp(str: string): string {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
