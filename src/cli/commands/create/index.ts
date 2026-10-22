import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { defineCommand, showUsage } from "citty";
import { consola } from "consola";
import { colors } from "consola/utils";
import { installDependencies, packageManagers, runScriptCommand } from "nypm";
import type { PackageManagerName } from "nypm";
import { dirname, relative, resolve } from "pathe";
import { findNearestFile, findWorkspaceDir } from "pkg-types";
import { hasTTY, isAgent } from "std-env";
import { createProject, isEmptyDir, projectTemplates } from "./_project.ts";

const DEFAULT_DIR = "nitro-app";

const pmNames = packageManagers.map((pm) => pm.name);

export default defineCommand({
  meta: {
    name: "create",
    description: "Create a new Nitro project",
  },
  args: {
    dir: {
      type: "positional",
      required: false,
      description: `Directory to create the project in (default: \`${DEFAULT_DIR}\`)`,
    },
    template: {
      type: "string",
      alias: "t",
      description: `Project template (${projectTemplates.map((t) => t.name).join(", ")})`,
    },
    force: {
      type: "boolean",
      description: "Override the contents of an existing directory",
    },
    install: {
      type: "boolean",
      default: true,
      description: "Install dependencies (use `--no-install` to skip)",
    },
    packageManager: {
      type: "string",
      alias: "p",
      description: `Package manager to install dependencies with (${pmNames.join(", ")})`,
    },
    gitInit: {
      type: "boolean",
      description: "Initialize a git repository",
    },
  },
  async run({ args, cmd }) {
    if (isAgent && !args.dir && !args.template) {
      await showUsage(cmd);
      process.exit(1);
    }
    const interactive = hasTTY && !isAgent;

    if (args.template && !projectTemplates.some((t) => t.name === args.template)) {
      return fail(
        `Unknown template \`${args.template}\`. Available templates: ${projectTemplates.map((t) => `\`${t.name}\``).join(", ")}.`
      );
    }
    if (args.packageManager && !pmNames.includes(args.packageManager as PackageManagerName)) {
      return fail(
        `Unknown package manager \`${args.packageManager}\`. Use one of: ${pmNames.join(", ")}.`
      );
    }

    let dir = resolve(
      args.dir ||
        (interactive
          ? await consola
              .prompt("Where would you like to create your Nitro project?", {
                type: "text",
                placeholder: `./${DEFAULT_DIR}`,
                default: DEFAULT_DIR,
                cancel: "reject",
              })
              .catch(() => process.exit(1))
          : DEFAULT_DIR)
    );

    let force = !!args.force;
    if (!interactive && !force && !(await isEmptyDir(dir))) {
      return fail(
        `Directory ${colors.cyan(displayPath(dir))} is not empty. Use \`--force\` to override its contents.`
      );
    }
    while (!force && !(await isEmptyDir(dir))) {
      const action = await consola
        .prompt(
          `Directory ${colors.cyan(displayPath(dir))} is not empty. What would you like to do?`,
          {
            type: "select",
            options: [
              { label: "Select a different directory", value: "new-directory" },
              { label: "Override its contents", value: "override" },
              { label: "Abort", value: "abort" },
            ],
            cancel: "reject",
          }
        )
        .catch(() => process.exit(1));
      if (action === "override") {
        force = true;
      } else if (action === "new-directory") {
        dir = resolve(
          await consola
            .prompt("Please specify a different directory:", { type: "text", cancel: "reject" })
            .catch(() => process.exit(1))
        );
      } else {
        process.exit(1);
      }
    }

    const template =
      args.template ||
      (interactive
        ? await consola
            .prompt("Which builder would you like to use?", {
              type: "select",
              options: projectTemplates.map((t) => ({
                label: `${t.title} ${colors.dim(`(${t.description})`)}`,
                value: t.name,
              })),
              cancel: "reject",
            })
            .catch(() => process.exit(1))
        : projectTemplates[0]!.name);

    await createProject(dir, { template, force });
    consola.success(`Created a new Nitro project in ${colors.cyan(displayPath(dir))}.`);

    const detectedPM = detectPackageManager();
    let packageManager: PackageManagerName | undefined;
    if (args.packageManager) {
      packageManager = args.packageManager as PackageManagerName;
    } else if (args.install && interactive) {
      packageManager =
        ((await consola.prompt("Which package manager would you like to use?", {
          type: "select",
          initial: detectedPM,
          options: [
            { label: "(none)", value: "", hint: "skip installing dependencies" },
            ...pmNames.map((pm) => ({
              label: pm,
              value: pm,
              hint: pm === detectedPM ? "current" : undefined,
            })),
          ],
          cancel: "undefined",
        })) as PackageManagerName | "" | undefined) || undefined;
    } else {
      packageManager = detectedPM || "npm";
    }

    if (args.install && packageManager) {
      consola.start(`Installing dependencies with \`${packageManager}\`...`);
      await installDependencies({ cwd: dir, packageManager });
      consola.success("Dependencies installed.");
    }

    const gitInit =
      args.gitInit ??
      (interactive &&
        (await consola.prompt("Initialize a git repository?", {
          type: "confirm",
          initial: !(await isInsideRepo(dir)),
          cancel: "undefined",
        })));
    if (gitInit) {
      try {
        execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
        consola.success("Git repository initialized.");
      } catch (error) {
        consola.warn(`Failed to initialize a git repository: ${(error as Error).message}`);
      }
    }

    const nextSteps = [
      displayPath(dir) !== "." && `cd ${displayPath(dir)}`,
      !(args.install && packageManager) && `${packageManager || "npm"} install`,
      runScriptCommand(packageManager || "npm", "dev"),
    ].filter(Boolean);
    consola.box(`Next steps:\n\n${nextSteps.map((step) => `  ${step}`).join("\n")}`);
  },
});

function fail(message: string): never {
  consola.error(message);
  process.exit(1);
}

function displayPath(dir: string): string {
  return relative(process.cwd(), dir) || ".";
}

/** Whether `dir` is inside a git repository or a monorepo (detected from its parent). */
async function isInsideRepo(dir: string): Promise<boolean> {
  const startingFrom = dirname(dir);
  const found = await Promise.all(
    [
      // `.git` is a file in worktrees and submodules
      findNearestFile(".git", { startingFrom, test: existsSync }),
      findWorkspaceDir(startingFrom, { tests: ["workspaceFile"] }),
    ].map((p) =>
      p.then(
        () => true,
        () => false
      )
    )
  );
  return found.some(Boolean);
}

function detectPackageManager(): PackageManagerName | undefined {
  const name = process.env.npm_config_user_agent?.split("/")[0] as PackageManagerName | undefined;
  return name && pmNames.includes(name) ? name : undefined;
}
