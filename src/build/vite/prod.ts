import type { ViteBuilder } from "vite";
import type { NitroPluginContext } from "./types.ts";

import { basename, resolve } from "pathe";
import { formatCompatibilityDate } from "compatx";
import { colors as C } from "consola/utils";
import { copyPublicAssets, prerender } from "../../builder.ts";
import { addClientAssetsDir } from "../assets.ts";
import { compressPublicAssets } from "../../utils/compress.ts";
import { existsSync } from "node:fs";
import { writeBuildInfo } from "../info.ts";
import { readFile, rm } from "node:fs/promises";
import { isTest, isCI } from "std-env";
import { readBuiltServiceEntry } from "./services.ts";
import { writeAssetsManifest } from "./_assets-build.ts";
import type { RolldownOutput } from "rolldown";

const BuilderNames = {
  nitro: C.magenta("Nitro"),
  client: C.green("Client"),
  ssr: C.blue("SSR"),
} as Record<string, string>;

export async function buildEnvironments(ctx: NitroPluginContext, builder: ViteBuilder) {
  const nitro = ctx.nitro!;

  // ----------------------------------------------
  // Stage 1: Build all environments before Nitro
  // ----------------------------------------------

  for (const [envName, env] of Object.entries(builder.environments)) {
    // prettier-ignore
    const fmtName = BuilderNames[envName] || (envName.length <= 3 ? envName.toUpperCase() : envName[0].toUpperCase() + envName.slice(1));
    if (env.isBuilt && ctx.services[envName] && !ctx._entryPoints[envName]) {
      const outDir = resolve(env.config.root, env.config.build.outDir);
      const entry = await readBuiltServiceEntry(outDir);
      if (entry) {
        ctx._entryPoints[envName] = entry;
      }
    }
    if (envName === "nitro" || !env.config.build.rollupOptions.input || env.isBuilt) {
      if (!["nitro", "ssr", "client"].includes(envName)) {
        nitro.logger.info(
          env.isBuilt
            ? `Skipping ${fmtName} (already built)`
            : `Skipping ${fmtName} (no input defined)`
        );
      }
      continue;
    }
    if (!isTest && !isCI) console.log();
    nitro.logger.start(`Building [${fmtName}]`);
    await builder.build(env);
  }

  // Page template: the client HTML built by Vite when the renderer template is the client input
  const template = nitro.options.renderer?.template;
  const clientInput = builder.environments.client?.config?.build?.rollupOptions?.input;
  let pageHTML: string | undefined;
  if (template && template === clientInput) {
    const outputPath = resolve(nitro.options.output.publicDir, basename(template));
    if (existsSync(outputPath)) {
      pageHTML = await readFile(outputPath, "utf8");
      await rm(outputPath);
    }
  }
  nitro._pageTemplate = {
    ...nitro._pageTemplate,
    html: pageHTML === undefined ? undefined : () => pageHTML,
  };

  // Write the manifest of `?assets` imports (server environments import it)
  if (ctx._assetsImport) {
    await writeAssetsManifest(builder, ctx._assetsImport);
  }

  // ----------------------------------------------
  // Stage 2: Build Nitro
  // ----------------------------------------------

  if (!isTest && !isCI) console.log();
  const buildInfo = [
    ["preset", nitro.options.preset],
    ["compatibility", formatCompatibilityDate(nitro.options.compatibilityDate)],
  ].filter((e) => e[1]);
  nitro.logger.start(
    `Building [${BuilderNames.nitro}] ${C.dim(`(${buildInfo.map(([k, v]) => `${k}: \`${v}\``).join(", ")})`)}`
  );

  // Copy public assets to the final output directory
  await copyPublicAssets(nitro);

  // Hashed client assets are immutable, missing ones get a `no-store` 404
  for (const env of Object.values(builder.environments)) {
    if (env.config.consumer === "client") {
      addClientAssetsDir(nitro, env.config.build.assetsDir);
    }
  }
  ctx.nitro!.routing.sync();

  // Prerender routes if configured
  await prerender(nitro);

  // Call vite:compile:before hook
  await nitro.hooks.callHook("vite:compile:before", nitro);

  if (nitro.options.compressPublicAssets) {
    await compressPublicAssets(nitro);
  }

  // Build the Nitro server bundle
  let output: RolldownOutput | undefined;
  if (nitro.options.static) {
    // Mark as built to opt out of Vite's fallback that builds every environment
    // when a `buildApp` hook left all of them unbuilt.
    builder.environments.nitro.isBuilt = true;
  } else {
    output = (await builder.build(builder.environments.nitro)) as RolldownOutput;
  }

  // Close the Nitro instance
  await nitro.close();

  // Call compiled hook
  await nitro.hooks.callHook("compiled", nitro);

  if (nitro.options.compressPublicAssets) {
    await compressPublicAssets(nitro);
  }

  // Write build info
  await writeBuildInfo(nitro, output);

  // Show deploy and preview commands
  if (!isTest && !isCI) console.log();
  const previewCommand = nitro.options.framework.previewCommand || "npx vite preview";
  nitro.logger.success(`You can preview this build using \`${previewCommand}\``);
  if (nitro.options.commands.deploy) {
    const deployCommand = nitro.options.framework.deployCommand || "npx nitro deploy --prebuilt";
    nitro.logger.success(`You can deploy this build using \`${deployCommand}\``);
  }
}
