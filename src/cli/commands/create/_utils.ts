import { existsSync } from "node:fs";
import { packageManagers } from "nypm";
import type { PackageManagerName } from "nypm";
import { relative } from "pathe";
import { findNearestFile, findWorkspaceDir } from "pkg-types";

export const pmNames = packageManagers.map((pm) => pm.name);

export function displayPath(dir: string): string {
  return relative(process.cwd(), dir) || ".";
}

/** Quote a path for copy-pasting into a shell (cmd and PowerShell on Windows, POSIX shells elsewhere). */
export function shellQuote(path: string): string {
  if (/^[\w./~@+-]+$/.test(path)) {
    return path;
  }
  return process.platform === "win32" ? `"${path}"` : `'${path.replaceAll("'", `'\\''`)}'`;
}

/** Whether `dir` is inside a git repository or a monorepo. */
export async function isInsideRepo(dir: string): Promise<boolean> {
  const found = await Promise.all(
    [
      // `.git` is a file in worktrees and submodules
      findNearestFile(".git", { startingFrom: dir, test: existsSync }),
      findWorkspaceDir(dir, { tests: ["workspaceFile"] }),
    ].map((p) =>
      p.then(
        () => true,
        () => false
      )
    )
  );
  return found.some(Boolean);
}

export function detectPackageManager(): PackageManagerName | undefined {
  const name = process.env.npm_config_user_agent?.split("/")[0] as PackageManagerName | undefined;
  return name && pmNames.includes(name) ? name : undefined;
}

/** Whether `error` is a spawn error for a missing executable. */
export function isNotFoundError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}
