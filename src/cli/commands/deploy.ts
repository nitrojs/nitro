import { defineCommand } from "citty";
import { relative, resolve } from "pathe";
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
      throw new Error("No build info found, cannot deploy.");
    }
    if (!buildInfo.commands?.deploy) {
      throw new Error("No deploy command found for this preset (are you missing --preset?).");
    }
    const { execSync } = await import("node:child_process");

    const deployCommand = buildInfo.commands.deploy.replace(
      /([\s:])\.\/(\S*)/g,
      `$1${relative(process.cwd(), outputDir)}/$2`
    );
    console.log(`$ ${deployCommand}`);
    execSync(deployCommand, { stdio: "inherit" });
  },
});
