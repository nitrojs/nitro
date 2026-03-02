import { defineCommand } from "citty";
import { relative, resolve } from "pathe";
import consola from "consola";
import { execSync } from "node:child_process";
import { getBuildInfo } from "../../build/info.ts";
import buildCmd, { buildArgs } from "./build.ts";

export default defineCommand({
  meta: {
    name: "deploy",
    description: "Build and deploy nitro project for production",
  },
  args: {
    ...buildArgs,
    prebuilt: {
      type: "boolean",
      description: "Skip the build step and deploy the existing build",
    },
  },
  async run(ctx) {
    if (!ctx.args.prebuilt) {
      await buildCmd.run!(ctx as any);
    }
    const rootDir = resolve((ctx.args.dir || ctx.args._dir || ".") as string);
    const { buildInfo, outputDir } = await getBuildInfo(rootDir);
    if (!buildInfo) {
      // throw new Error("No build info found, cannot deploy.");
      consola.error("No build info found, cannot deploy.");
      process.exit(1);
    }
    if (!buildInfo.commands?.deploy) {
      consola.error(
        `The \`${buildInfo.preset}\` preset does not have a default deploy command.\n\nTry using a different preset with the \`--preset\` option, or configure a deploy command in the Nitro config, or deploy manually.`
      );
      process.exit(1);
    }

    const extraArgs =
      ctx.rawArgs.indexOf("--") !== -1
        ? ctx.rawArgs.slice(ctx.rawArgs.indexOf("--") + 1).join(" ")
        : "";

    const deployCommand =
      buildInfo.commands.deploy.replace(
        /([\s:])\.\/(\S*)/g,
        `$1${relative(process.cwd(), outputDir)}/$2`
      ) + (extraArgs ? ` ${extraArgs}` : "");

    consola.info(`$ ${deployCommand}`);
    execSync(deployCommand, { stdio: "inherit" });
  },
});
