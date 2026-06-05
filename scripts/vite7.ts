import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const workspacePath = resolve(import.meta.dirname, "../pnpm-workspace.yaml");
const workspace = readFileSync(workspacePath, "utf8");

const updated = workspace.replace(/^(\s*)#\s*"vite":\s*"\^7"/m, '$1"vite": "^7"');

if (updated === workspace) {
  throw new Error('Could not find commented `# "vite": "^7"` line in pnpm-workspace.yaml');
}

writeFileSync(workspacePath, updated);

console.log('Uncommented "vite": "^7" in pnpm-workspace.yaml');

execSync("pnpm install --no-frozen-lockfile", {
  stdio: "inherit",
  cwd: resolve(import.meta.dirname, ".."),
});
