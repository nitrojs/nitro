import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const pkgPath = resolve(import.meta.dirname, "../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

pkg.resolutions = pkg.resolutions || {};
pkg.resolutions.vite = "^7";

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log("Added vite: ^7 to resolutions");

execSync("pnpm install --no-frozen-lockfile", {
  stdio: "inherit",
  cwd: resolve(import.meta.dirname, ".."),
});
