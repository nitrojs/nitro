import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "pathe";
import { pkgDir } from "#nitro/meta";
import { projectTemplates, sharedFiles } from "./_templates.ts";

export { projectTemplates };

export interface CreateProjectOptions {
  /** Template name (see `projectTemplates`). */
  template: string;
  /** Write into a non-empty directory, overriding existing files. */
  force?: boolean;
}

export interface CreateProjectResult {
  /** Paths of the existing files that were overwritten (with `force`). */
  overwritten: string[];
}

/**
 * Create a new Nitro project in `dir` from a template built into Nitro.
 *
 * The `nitro` dependency is pinned to the running Nitro version.
 */
export async function createProject(
  dir: string,
  opts: CreateProjectOptions
): Promise<CreateProjectResult> {
  const template = projectTemplates.find((t) => t.name === opts.template);
  if (!template) {
    throw new Error(
      `Unknown template \`${opts.template}\`. Available templates: ${projectTemplates.map((t) => `\`${t.name}\``).join(", ")}.`
    );
  }
  if (!opts.force && !(await isEmptyDir(dir))) {
    throw new Error(`Directory \`${dir}\` is not empty. Use \`--force\` to override its contents.`);
  }

  const pkg = {
    name: packageName(dir),
    private: true,
    type: "module",
    scripts: template.scripts,
    dependencies: { nitro: await nitroDependency() },
    devDependencies: sortKeys({
      "@types/node": "latest",
      typescript: "latest",
      ...template.devDependencies,
    }),
  };
  const files = {
    ...sharedFiles,
    ...template.files,
    "package.json": JSON.stringify(pkg, null, 2) + "\n",
  };
  const overwritten: string[] = [];
  for (const [path, contents] of Object.entries(files)) {
    if (existsSync(join(dir, path))) {
      overwritten.push(path);
    }
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), contents);
  }
  return { overwritten };
}

/** Whether `dir` does not exist or is empty (a `.git` directory alone is ignored). */
export async function isEmptyDir(dir: string): Promise<boolean> {
  return !existsSync(dir) || (await readdir(dir)).every((entry) => entry === ".git");
}

async function nitroDependency(): Promise<string> {
  const { name, version } = JSON.parse(await readFile(join(pkgDir, "package.json"), "utf8"));
  return name === "nitro" ? `^${version}` : `npm:${name}@${version}`;
}

function packageName(dir: string): string {
  return (
    basename(dir)
      .toLowerCase()
      .replace(/[^\w.~-]+/g, "-")
      .replace(/^[._-]+/, "") || "nitro-app"
  );
}

function sortKeys(obj: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}
