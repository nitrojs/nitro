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

/**
 * Create a new Nitro project in `dir` from a template built into Nitro.
 *
 * The `nitro` dependency is pinned to the running Nitro version.
 */
export async function createProject(dir: string, opts: CreateProjectOptions): Promise<void> {
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
    devDependencies: sortKeys({
      "@types/node": "latest",
      nitro: await nitroDependency(),
      typescript: "latest",
      ...template.devDependencies,
    }),
  };
  const files = {
    ...sharedFiles,
    ...template.files,
    "package.json": JSON.stringify(pkg, null, 2) + "\n",
  };
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), contents);
  }
}

export async function isEmptyDir(dir: string): Promise<boolean> {
  return !existsSync(dir) || (await readdir(dir)).length === 0;
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
