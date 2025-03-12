import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const _dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonFile = join(_dirname, "../package.json");

const packageJsonText = readFileSync(packageJsonFile, { encoding: `utf-8` });

export const version = JSON.parse(packageJsonText)?.version || "0.0.0";
