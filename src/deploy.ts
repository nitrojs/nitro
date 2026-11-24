import type { Nitro } from "nitro/types";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import consola from "consola";
import { relative, resolve } from "pathe";

export interface DeployOptions {
  /** Extra arguments appended to the deploy command. */
  args?: string[];
}

export async function deploy(nitro: Nitro, opts: DeployOptions = {}): Promise<void> {
  const outputDir = nitro.options.output.dir;
  if (!existsSync(resolve(outputDir, "nitro.json"))) {
    throw new Error(
      `No build output found in \`${outputDir}\`. Make sure to build first before deploying.`
    );
  }

  const deployCommand = nitro.options.commands.deploy;
  if (!deployCommand) {
    throw new Error(
      `The \`${nitro.options.preset}\` preset does not have a default deploy command.\n\nTry using a different preset with the \`--preset\` option, or configure a deploy command in the Nitro config, or deploy manually.`
    );
  }

  if (typeof deployCommand === "function") {
    await deployCommand(nitro, opts);
    return;
  }

  const cwd = nitro.options.rootDir;
  const command = [
    rewriteDeployPaths(deployCommand, relative(cwd, outputDir) || "."),
    ...(opts.args || []),
  ].join(" ");

  consola.info(`$ ${command}`);
  execSync(command, { stdio: "inherit", cwd });
}

// `./` resolves to outputDir only where it is a standalone path argument. A
// `./` inside quoted shell code (for example `require("./x")` in `node -e`)
// keeps its working-directory meaning: the quote it follows did not open a
// path argument, so it is left untouched.
function rewriteDeployPaths(command: string, outputDir: string): string {
  return command.replace(
    /(^|[\s:"'])\.\/(\S*)/g,
    (match, prefix: string, path: string, offset: number) => {
      if ((prefix === '"' || prefix === "'") && offset > 0 && !/[\s:=]/.test(command[offset - 1])) {
        return match;
      }
      return `${prefix}${outputDir}/${path}`;
    }
  );
}
